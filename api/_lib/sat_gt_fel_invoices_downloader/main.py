import re
import os.path
import base64
import codecs
import logging
from curl_cffi import requests # Reemplazo de requests para evasión Anti-Bot
from bs4 import BeautifulSoup, CData
from urllib.parse import urlencode
from datetime import datetime
from .models import (
    EstadoDTE,
    Invoice,
    InvoiceLine,
    InvoiceTotals,
    SATFELFilters,
    TotalTax,
    Address,
    ContactModel,
    InvoiceHeaders,
    IssuingModel,
    TypeFEL,
)
from .actions import SATDoLogin, SATDoLogout, SATGetMenu, SATGetStablisments
from contextlib import contextmanager

"""
Private class that makes all the action
"""

TIMEOUT = 20


class SatFelDownloader:
    def __init__(self, credentials, url_get_fel, request_session=None):
        self._credentials = credentials
        self._view_state = None
        self._url_get_fel = url_get_fel
        
        # 1. Inicializar sesión con impersonación de Chrome 124 (Windows)
        # Esto evade el TLS fingerprinting de Cloudflare
        self._session = request_session or requests.Session(impersonate="chrome124")
        
        # 2. Configurar cabeceras de navegación humana avanzada
        self._session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate, br, zstd",
            "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
            "Referer": "https://farm3.sat.gob.gt/menu/login.jsf"
        })

    def _login(self):
        # 1. GET Inicial para obtener JSESSIONID y el ViewState de partida
        login_url = "https://farm3.sat.gob.gt/menu/login.jsf"
        try:
            r_init = self._session.get(login_url, timeout=TIMEOUT)
            r_init.raise_for_status()
            
            bs_init = BeautifulSoup(r_init.text, features="html.parser")
            view_state_input = bs_init.find("input", {"name": "javax.faces.ViewState"})
            initial_view_state = view_state_input["value"] if view_state_input else ""
            
            logging.info(f"Conexión inicial establecida. Cookies: {self._session.cookies.get_dict()}")

            # 2. POST con credenciales y ViewState inicial
            login_dict = {
                "formContent": "formContent",
                "formContent:username": self._credentials.username,
                "formContent:password": self._credentials.password,
                "formContent:cmdbtnIngresar": "", 
                "javax.faces.ViewState": initial_view_state,
            }
            
            # El portal a veces redirige, curl_cffi lo maneja automáticamente
            r = self._session.post(login_url, data=login_dict, timeout=TIMEOUT)
            
            if r.status_code == 500:
                 logging.error(f"Error 500 en Login. Posible ViewState inválido. Cookies actuales: {self._session.cookies.get_dict()}")
                 return False

            r.raise_for_status()
            
            # 3. Extraer el ViewState final para las siguientes consultas
            bs = BeautifulSoup(r.text, features="html.parser")
            view_state = bs.find("input", {"name": "javax.faces.ViewState"})
            
            if view_state and "value" in view_state.attrs:
                self._view_state = view_state["value"]
                logging.info("Login exitoso y ViewState capturado.")
                return True
                
        except Exception as e:
            logging.error(f"Error en el proceso de login: {str(e)}")
            return False
            
        return False

    def _get_invoices_headers(self, filter: SATFELFilters):
        logging.info("CALL URL GET FEL (ESTABLISHING SESSION)")
        
        # Debemos visitar la URL de redirección para que se activen las cookies ACCESS_TOKEN / felTokc
        # Esta URL es la que el menú generó dinámicamente
        r_fel = self._session.get(self._url_get_fel, timeout=TIMEOUT, allow_redirects=True)
        
        operation_param = filter.tipo
        cookie = self._session.cookies.get("ACCESS_TOKEN") or self._session.cookies.get("felTokc")
        if not cookie:
            # En curl_cffi la sesión puede devolver un dict o un CookieJar diferente
            try:
                cookie_names = list(self._session.cookies.keys())
            except:
                cookie_names = [str(c) for c in self._session.cookies]
            raise Exception("Neither ACCESS_TOKEN nor felTokc found in cookies! Cookies found: " + str(cookie_names))
        
        dict_query = {
            "usuario": self._credentials.username,
            "tipoOperacion": operation_param.value,
            "nitIdReceptor": "",
            "estadoDte": filter.estadoDte.value,
            "fechaEmisionIni": filter.fechaInicio.strftime("%d-%m-%Y"),
            "fechaEmisionFinal": filter.fechaFin.strftime("%d-%m-%Y"),
        }
        logging.info("Querying invoices")
        logging.debug(dict_query)
        url = (
            "https://felcons.c.sat.gob.gt/dte-agencia-virtual/api/consulta-dte?"
            + urlencode(dict_query)
        )
        header = {"authtoken": "token " + cookie}
        r = self._session.get(url, headers=header, timeout=TIMEOUT)
        r.raise_for_status()
        
        json_res = r.json()
        detalle = json_res.get("detalle") or {}
        return detalle.get("data", [])

    def get_invoices(self, filter: SATFELFilters):
        """Método público para compatibilidad con sat_bridge.py"""
        return self._get_invoices_headers(filter)

    def _process_contingency_pdf(self, invoice, filetype, received):
        url = "https://felav02.c.sat.gob.gt/verificador-rest/rest/publico/descargapdf"
        invoice = {
            "autorizacion": invoice["numeroUuid"],
            "emisor": invoice["nitEmisor"],
            "estado": "V",
            "monto": invoice["granTotal"],
            "receptor": invoice["nitReceptor"],
        }

        r = self._session.post(url, json=invoice, timeout=TIMEOUT)
        if r.status_code == 200:
            base64encoded = r.json()[0]
            bytes = base64.b64decode(base64encoded)
            if bytes[0:4] != b"%PDF":
                raise ValueError("Missing the PDF file signature")
            r.bytes = bytes
        return r, True

    def _get_response(self, invoice, filetype, received=True):
        url = None
        is_contingency = False
        # print(invoice)
        if filetype.lower() == "xml":
            url = (
                "https://felcons.c.sat.gob.gt/dte-agencia-virtual/api/consulta-dte/xml?"
            )

        elif filetype.lower() == "pdf":
            url = (
                "https://felcons.c.sat.gob.gt/dte-agencia-virtual/api/consulta-dte/pdf?"
            )

        if url is None:
            return None
        operation_param = "R" if received else "E"

        dict_query = {
            "usuario": self._credentials.username,
            "tipoOperacion": operation_param,
            "nitIdReceptor": "",
        }
        url += urlencode(dict_query)
        cookie = self._session.cookies.get("ACCESS_TOKEN") or self._session.cookies.get("felTokc")
        header = {"authtoken": "token " + cookie}
        r = self._session.post(url, headers=header, json=[invoice], timeout=TIMEOUT)
        if r.status_code == 500:
            logging.warn("Did get 500 error trying pdf contingency")
            return self._process_contingency_pdf(invoice, "pdf-contingency", received)
        # print(r)
        return r, is_contingency

    def get_pdf_content(self, invoice, received=True):
        r, is_contingency = self._get_response(
            invoice, filetype="pdf", received=received
        )
        
        if is_contingency:
            return r.bytes
        return r.content

    def get_pdf(self, invoice, save_in_dir=None, received=True):
        r, is_contingency = self._get_response(
            invoice, filetype="pdf", received=received
        )
        filename = self.get_filename_from_cd(r.headers.get("Content-Disposition"))
        if not filename:
            filename = invoice["numeroUuid"] + ".pdf"
        if save_in_dir:
            filename = os.path.join(save_in_dir, filename)
        if is_contingency:
            open(filename, "wb+").write(r.bytes)
        else:
            open(filename, "wb+").write(r.content)
        return filename

    def _process_invoice_lines(self, xml_lines):
        lines = xml_lines
        model_lines = []
        for item in lines:
            quantity = item.Cantidad.text
            good_or_service = item["BienOServicio"]
            line_number = item["NumeroLinea"]
            if "UnidadMedida" in item:
                uom = item.UnidadMedida.text
            description = item.Descripcion.text.strip()
            unit_price = item.PrecioUnitario.text
            total_before_discount = item.Precio.text
            discount = item.Descuento.text
            total = item.Total.text
            line = (
                InvoiceLine.builder()
                .set_quantity(float(quantity))
                .set_good_or_service(good_or_service)
                .set_line_number(int(line_number))
                .set_description(description)
                .set_unit_price(float(unit_price))
                .set_total_line(float(total_before_discount))
                .set_discount(float(discount))
                .set_total(float(total))
                .build()
            )
            model_lines.append(line)
        return model_lines

    def get_invoice_model(self, invoice, received=True):
        xml_content = self.get_xml_content(invoice, received)
        bs = BeautifulSoup(xml_content, "xml")
        emission_data = bs.find("DatosEmision")
        general_data = emission_data.select("DatosGenerales")[0]
        issuer = emission_data.select("Emisor")[0]
        receptor = emission_data.select("Receptor")[0]
        lines = emission_data.select("Item")
        currency = general_data["CodigoMoneda"]
        
        try:
             
            issue_date = datetime.strptime(
                general_data["FechaHoraEmision"], "%Y-%m-%dT%H:%M:%S%z"
            )
        except ValueError:
            try:
                issue_date = datetime.strptime(
                general_data["FechaHoraEmision"], "%Y-%m-%dT%H:%M:%S.%f%z"
                )
            except:
                try:
                    issue_date = datetime.strptime(
                    general_data["FechaHoraEmision"], "%Y-%m-%dT%H:%M:%S.%f"
                    )
                except:
                    issue_date = datetime.strptime(
                    general_data["FechaHoraEmision"], "%Y-%m-%dT%H:%M:%S"
                    )
            
        invoice_type = general_data["Tipo"]
        vat_affiliation = issuer["AfiliacionIVA"]
        stablisment_number = issuer["CodigoEstablecimiento"]
        
        issuer_email = issuer["CorreoEmisor"] if "CorreoEmisor" in issuer else None
        issuernit = issuer["NITEmisor"]
        commercial_name = issuer["NombreComercial"]
        issuer_name = issuer["NombreEmisor"]
        receptor_email = receptor.find("CorreoReceptor")
        emissor_address = issuer.find("Direccion").text
        zip_code = issuer.find("CodigoPostal").text
        city = issuer.find("Municipio").text
        state = issuer.find("Departamento").text
        country = issuer.find("Pais").text
        nit_receptor = receptor["IDReceptor"]
        nombre_receptor = receptor["NombreReceptor"]
        model_lines = self._process_invoice_lines(lines)
        total = emission_data.Totales
        total_taxes = total.select("TotalImpuesto")
        grand_total = total.find("GranTotal").text

        total_taxes_model = []
        for tax in total_taxes:
            tax_model = (
                TotalTax.builder()
                .set_tax_name(tax["NombreCorto"])
                .set_tax_total(tax["TotalMontoImpuesto"])
                .build()
            )
            total_taxes_model.append(tax_model)
        address_model = (
            Address.builder()
            .set_street(emissor_address)
            .set_zip_code(zip_code)
            .set_city(city)
            .set_state(state)
            .set_country(country)
            .build()
        )
        issuer_model = (
            IssuingModel.builder()
            .set_nit(issuernit)
            .set_commercial_name(commercial_name)
            .set_issuing_name(issuer_name)
            .set_address(address_model)
            .set_vat_affiliation(vat_affiliation)
            .set_establishment(stablisment_number)
            .set_email(issuer_email)
            .build()
        )
        receiver = (
            ContactModel.builder()
            .set_nit(nit_receptor)
            .set_commercial_name(nombre_receptor)
            .set_address("CIUDAD")
            .set_email(receptor_email)
            .build()
        )
        invoice_header = (
            InvoiceHeaders.builder()
            .set_issue_date(issue_date)
            .set_invoice_type(invoice_type)
            .set_currency(currency)
            .set_issuer(issuer_model)
            .set_receiver(receiver)
            .build()
        )
        invoice_total = InvoiceTotals(total_taxes_model, grand_total=float(grand_total))
        fel_data = bs.find("Certificacion").find("NumeroAutorizacion")
        fel_invoice_number = fel_data["Numero"]
        fel_invoice_serie = fel_data["Serie"]
        fel_signature = fel_data.text
        invoice = (
            Invoice.builder()
            .with_headers(invoice_header)
            .with_lines(model_lines)
            .with_totals(invoice_total)
            .set_fel_signature(fel_signature)
            .set_fel_invoice_number(fel_invoice_number)
            .set_fel_invoice_serie(fel_invoice_serie)
            .build()
        )
        return invoice

    def get_invoices(self, type_invoice, start_date, end_date):
        """Metodo de alto nivel que trae el listado Y el XML de cada factura"""
        headers = self._get_invoices_headers(type_invoice, start_date, end_date)
        invoices = headers.get("data", [])
        
        print(f"[PY] Extrayendo XMLs para {len(invoices)} facturas...", file=sys.stderr)
        
        for inv in invoices:
            try:
                # La función get_xml requiere el objeto completo de la factura del listado
                xml_content_bytes = self.get_xml(inv)
                # Convertimos bytes a string con manejo de errores para caracteres extraños
                if isinstance(xml_content_bytes, bytes):
                    inv['xml_content'] = xml_content_bytes.decode('utf-8', errors='replace')
                else:
                    inv['xml_content'] = xml_content_bytes
            except Exception as e:
                print(f"[PY] Error bajando XML para UUID {inv.get('uuid')}: {e}", file=sys.stderr)
        
        return invoices

    def get_xml_content(self, invoice, received=True):
        return self._get_response(
            invoice=invoice, filetype="xml", received=received
        )[0].content

    def get_xml(self, invoice, save_in_dir=None, received=True):
        r, _ = self._get_response(invoice=invoice, filetype="xml", received=received)
        filename = self.get_filename_from_cd(r.headers.get("Content-Disposition"))
        if not filename:
            filename = invoice["numeroUuid"] + ".xml"
        if save_in_dir:
            filename = os.path.join(save_in_dir, filename)
            open(filename, "wb").write(r.content)
            return filename
        else:
            return r.content

    def get_filename_from_cd(self, cd):
        """
        Get filename from content-disposition
        """

        if not cd:
            return None
        fname = re.findall("filename=(.+)", cd)
        if len(fname) == 0:
            return None
        return fname[0].replace('"', "")


"""
Main entrance of the SAT Downloader.
"""


class SATDownloader:
    def __init__(self, request_session=None):
        self.credentials = None
        self.session = request_session or requests.Session(impersonate="chrome124")
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "es-ES,es;q=0.9",
        })
        self.url_get_fel = None
        self.its_initialized = False
        self.view_state = None

    "Need to set credentials before use any of the methods"

    def setCredentials(self, credentials):
        self.credentials = credentials
        return self

    def initialize(self):
        if self.credentials is None:
            raise ValueError(
                "You didn't provided credentials. Please use setCredentials method"
            )
        
        # 1. Login robusto con JSF
        action_login = SATDoLogin(self.credentials, self.session)
        did_login, view_state = action_login.execute()
        
        # Necesitamos el HTML del login para extraer la redirección del menú
        # Lo obtenemos del atributo privado si lo añadimos o simplemente lo capturamos
        login_html = action_login._last_html if hasattr(action_login, "_last_html") else None
        
        if not did_login or not view_state:
            raise ValueError("The credentials you provided are not valid")
            
        logging.info("Did authenticate")
        
        # 2. Navegación de menú para obtener el token dinámico (ACCESS_TOKEN)
        menu = SATGetMenu(self.session, view_state)
        try:
            (did_get_menu, url) = menu.execute(login_html=login_html)
        except Exception as e:
            # Si falla aquí, revisamos si Cloudflare nos bloqueó con un JS Challenge
            if login_html and ("challenge-platform" in login_html or "Cloudflare" in login_html):
                 raise Exception("Cloudflare detectó la sesión como bot (JS Challenge). Por favor, espere unos minutos o intente cambiar el User-Agent.")
            raise e
        
        logging.info("Did get menu URL")
        self.url_get_fel = url
        if not did_get_menu:
            raise ValueError("Could not get the menu")
        self.its_initialized = True
        self.view_state = view_state
        logging.info("Initialization process finished")

    """
        Remember to logout after you have finished your operations to make sure you don't interfere with web login.
    """

    def logout(self):
        SATDoLogout(self.session, self.view_state).execute()
        self.its_initialized = False
        self.view_state = None
        self.url_get_fel = None

    def get_stablisments(self):

        if not self.its_initialized:
            self.initialize()
        stablisments = SATGetStablisments(self.session).execute()
        return stablisments

    def get_invoices_with_filters(self, filters: SATFELFilters):
        logging.info("GET INVOICES WITH FILTERS")
        if not self.its_initialized:
            self.initialize()
        downloader = SatFelDownloader(
            self.credentials, url_get_fel=self.url_get_fel, request_session=self.session
        )
        return downloader._get_invoices_headers(filters)

    def get_invoices(self, date_start, date_end, received=True):
        logging.info("GET INVOICES WITH OLD FORMAT")

        type_fel = TypeFEL.RECIBIDA if received else TypeFEL.EMITIDA
        filter = SATFELFilters(0, EstadoDTE.TODOS, date_start, date_end, type_fel)
        return self.get_invoices_with_filters(filter)

    def get_invoices_models(self, date_start, date_end, received=True):
        if not self.its_initialized:
            self.initialize()
        downloader = SatFelDownloader(
            self.credentials, url_get_fel=self.url_get_fel, request_session=self.session
        )
        invoices = self.get_invoices(date_start, date_end, received)
        invoices_model = list(map(downloader.get_invoice_model, invoices))
        return invoices_model

    def get_model(self, invoice):
        if not self.its_initialized:
            self.initialize()
        downloader = SatFelDownloader(
            self.credentials, url_get_fel=self.url_get_fel, request_session=self.session
        )
        return downloader.get_invoice_model(invoice)

    def get_pdf_content(self, invoice, save_in_dir=None):
        if not self.its_initialized:
            self.initialize()
        downloader = SatFelDownloader(
            self.credentials, url_get_fel=self.url_get_fel, request_session=self.session
        )
        return downloader.get_pdf_content(invoice, save_in_dir)

    def get_pdf(self, invoice, save_in_dir=None):
        if not self.its_initialized:
            self.initialize()
        downloader = SatFelDownloader(
            self.credentials, url_get_fel=self.url_get_fel, request_session=self.session
        )
        return downloader.get_pdf(invoice, save_in_dir)

    def get_xml_content(self, invoice):
        if not self.its_initialized:
            self.initialize()
        downloader = SatFelDownloader(
            self.credentials, url_get_fel=self.url_get_fel, request_session=self.session
        )
        downloader.get_xml_content(invoice)

    def get_xml(self, invoice, save_in_dir=None):
        if not self.its_initialized:
            self.initialize()
        downloader = SatFelDownloader(
            self.credentials, url_get_fel=self.url_get_fel, request_session=self.session
        )
        downloader.get_xml(invoice, save_in_dir)

if __name__ == "__main__":
    import sys
    import json
    import logging
    from bs4 import BeautifulSoup

    # Configuración de logs mínima para no ensuciar el JSON
    logging.basicConfig(level=logging.ERROR)

    try:
        args = sys.argv[1:]
        if len(args) < 5:
            print(json.dumps({"error": "Faltan argumentos (nit, user, pass, start, end, type)"}))
            sys.exit(1)

        nit_arg, user_arg, pass_arg, start_date, end_date, tipo = args[0], args[1], args[2], args[3], args[4], args[5]
        
        sat = SatGTPortal(nit_arg, user_arg, pass_arg)
        is_received = (tipo.lower() in ["recibida", "recibidas", "compras"])
        
        invoices_raw = sat.get_invoices(start_date, end_date, is_received)
        
        final_invoices = []
        for inv in invoices_raw:
            try:
                # Descargar el XML para extraer el detalle real
                xml_str = sat.get_xml_content(inv)
                if not xml_str: xml_str = ""
                
                # PARSEO ROBUSTO CON BEAUTIFULSOUP
                soup = BeautifulSoup(xml_str, "xml")
                
                # REGLA ESTRICTA: EL UUID ES EL TEXTO DEL NODO NumeroAutorizacion
                num_auth_node = soup.find(lambda tag: tag.name.split(':')[-1] == 'NumeroAutorizacion')
                
                if num_auth_node:
                    uuid_val = num_auth_node.text.strip()
                    serie_val = num_auth_node.get('Serie', '')
                    num_val = num_auth_node.get('Numero', '')
                else:
                    # Si no hay nodo, buscarlo en el objeto original o marcar error
                    uuid_val = inv.get('uuid') or inv.get('guid') or "FALTA-UUID"
                    serie_val = ""
                    num_val = ""

                # 2. Emisor (NIT y Nombre)
                emisor_node = soup.find(lambda tag: tag.name.split(':')[-1] == 'Emisor')
                nit_emisor = emisor_node.get('NITEmisor', '') if emisor_node else ""
                nombre_emisor = emisor_node.get('NombreEmisor', '') if emisor_node else ""

                # 3. Datos Generales (Fecha)
                gen_node = soup.find(lambda tag: tag.name.split(':')[-1] == 'DatosGenerales')
                fecha_emision = gen_node.get('FechaHoraEmision', '') if gen_node else ""

                # 4. Totales
                total_node = soup.find(lambda tag: tag.name.split(':')[-1] == 'GranTotal')
                monto_total = total_node.text.strip() if total_node else 0

                # 5. Items (Detalle Obligatorio)
                items = []
                item_nodes = soup.find_all(lambda tag: tag.name.split(':')[-1] == 'Item')
                for node in item_nodes:
                    try:
                        cant = node.find(lambda tag: tag.name.split(':')[-1] == 'Cantidad')
                        desc = node.find(lambda tag: tag.name.split(':')[-1] == 'Descripcion')
                        p_uni = node.find(lambda tag: tag.name.split(':')[-1] == 'PrecioUnitario')
                        tot = node.find(lambda tag: tag.name.split(':')[-1] == 'Total')
                        
                        items.append({
                            "cantidad": cant.text.strip() if cant else "1",
                            "descripcion": desc.text.strip() if desc else "S/D",
                            "precio_unitario": p_uni.text.strip() if p_uni else "0",
                            "total": tot.text.strip() if tot else "0"
                        })
                    except: pass

                final_invoices.append({
                    "uuid": uuid_val,
                    "xml_content": xml_str,
                    "serie": serie_val,
                    "numero": num_val,
                    "nit_emisor": nit_emisor,
                    "nombre_emisor": nombre_emisor,
                    "fecha_emision": fecha_emision,
                    "total": monto_total,
                    "items": items,
                    "tipo": tipo
                })
            except Exception as e:
                # Log de error silencioso en la lista
                final_invoices.append({
                    "uuid": inv.get('uuid', 'ERROR-ID'),
                    "error_xml": str(e),
                    "items": []
                })

        # DEBUG PYTHON OUT: Escribir el primer UUID en stderr para verlo en el CMD
        if final_invoices:
            import sys
            sys.stderr.write(f"\nDEBUG PYTHON OUT: UUID Encontrado -> {final_invoices[0].get('uuid')}\n")

        print(json.dumps({"invoices": final_invoices}))

    except Exception as e:
        import sys
        import json
        sys.stderr.write(f"\nFATAL PYTHON ERROR: {str(e)}\n")
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
