import re
import os.path
import base64
import codecs
import logging
import requests
import concurrent.futures
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
from .actions import SATDoLogin, SATDoLogout, SATGetMenu, SATGetStablisments, SATGetRetentionsUrl
from contextlib import contextmanager

"""
Private class that makes all the action
"""

TIMEOUT = 20


class SatFelDownloader:
    def __init__(self, credentials, url_get_fel, request_session=requests.Session()):
        self._credentials = credentials
        self._session = request_session
        self._view_state = None
        self._url_get_fel = url_get_fel

    def _login(self):
        login_dict = {
            "login": self._credentials.username,
            "password": self._credentials.password,
            "operacion": "ACEPTAR",
        }
        r = self._session.post(
            "https://farm3.sat.gob.gt/menu/init.do", data=login_dict, timeout=TIMEOUT
        )
        r.raise_for_status()
        bs = BeautifulSoup(r.text, features="html.parser")
        logging.info("Did login")
        view_state = bs.find("input", {"name": "javax.faces.ViewState"})
        if view_state and "value" in view_state:
            self._view_state = view_state["value"]
            logging.info("Did get view state")
            return True
        return False

    def _get_invoices_headers(self, filter: SATFELFilters):
        logging.info("CALL URL GET FEL (MULTIPAGE PARALLEL)")
        r_fel = self._session.get(self._url_get_fel, timeout=TIMEOUT)
        
        operation_param = filter.tipo
        cookie = self._session.cookies.get("ACCESS_TOKEN") or self._session.cookies.get("felTokc")
        if not cookie:
            cookie_names = [c.name for c in self._session.cookies]
            raise Exception("Neither ACCESS_TOKEN nor felTokc found in cookies! Cookies found: " + str(cookie_names))
        
        page_size = 50
        
        def fetch_page(p_num):
            dict_query = {
                "usuario": self._credentials.username,
                "tipoOperacion": operation_param.value,
                "nitIdReceptor": "",
                "estadoDte": filter.estadoDte.value,
                "fechaEmisionIni": filter.fechaInicio.strftime("%d-%m-%Y"),
                "fechaEmisionFinal": filter.fechaFin.strftime("%d-%m-%Y"),
                "pPagina": str(p_num),
                "pRegistrosPorPagina": str(page_size)
            }
            url = "https://felcons.c.sat.gob.gt/dte-agencia-virtual/api/consulta-dte?" + urlencode(dict_query)
            header = {"authtoken": "token " + cookie}
            r = self._session.get(url, headers=header, timeout=TIMEOUT)
            r.raise_for_status()
            return r.json().get("detalle", {}).get("data", [])

        # 1. Petición inicial para la página 1 y obtener el total de registros
        dict_query_init = {
            "usuario": self._credentials.username,
            "tipoOperacion": operation_param.value,
            "nitIdReceptor": "",
            "estadoDte": filter.estadoDte.value,
            "fechaEmisionIni": filter.fechaInicio.strftime("%d-%m-%Y"),
            "fechaEmisionFinal": filter.fechaFin.strftime("%d-%m-%Y"),
            "pPagina": "1",
            "pRegistrosPorPagina": str(page_size)
        }
        url_init = "https://felcons.c.sat.gob.gt/dte-agencia-virtual/api/consulta-dte?" + urlencode(dict_query_init)
        header_init = {"authtoken": "token " + cookie}
        r_init = self._session.get(url_init, headers=header_init, timeout=TIMEOUT)
        r_init.raise_for_status()
        
        json_res = r_init.json()
        total_registros = json_res.get("detalle", {}).get("totalRegistros", 0)
        all_invoices = json_res.get("detalle", {}).get("data", [])
        
        if total_registros <= page_size:
            return all_invoices

        # 2. Calcular cuantas páginas faltan
        import math
        total_pages = math.ceil(total_registros / page_size)
        logging.info(f"Total registros: {total_registros}, paginas: {total_pages}. Iniciando Multi-fetch...")
        
        # 3. Descargar el resto de páginas en paralelo (Páginas 2 hasta total_pages)
        pages_to_fetch = range(2, total_pages + 1)
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            future_to_page = {executor.submit(fetch_page, p): p for p in pages_to_fetch}
            for future in concurrent.futures.as_completed(future_to_page):
                try:
                    data = future.result()
                    all_invoices.extend(data)
                except Exception as e:
                    logging.error(f"Error descargando página: {str(e)}")
                    
        logging.info(f"Total so far (all pages): {len(all_invoices)}")
        return all_invoices

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
        print(invoice)
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
        print(r)
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
        emissor_address = issuer.find("Direccion").Text
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
    def __init__(self, request_session=requests.Session()):
        self.credentials = None
        self.session = request_session
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
        did_login, view_state, login_html = SATDoLogin(self.credentials, self.session).execute()
        if not did_login or not view_state:
            raise ValueError("The credentials you provided are not valid")
        logging.info("Did authenticate")
        self.login_html = login_html # Guardar para poder navegar a otros menús
        menu = SATGetMenu(self.session, view_state)
        (did_get_menu, url) = menu.execute(login_html=login_html)
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
        return downloader.get_xml_content(invoice)

    def get_xml(self, invoice, save_in_dir=None):
        if not self.its_initialized:
            self.initialize()
        downloader = SatFelDownloader(
            self.credentials, url_get_fel=self.url_get_fel, request_session=self.session
        )
        downloader.get_xml(invoice, save_in_dir)

    def get_constancias_retencion(self, date_start, date_end):
        """
        Scrape Constancias de Retención from Agencia Virtual
        """
        if not self.its_initialized:
            self.initialize()
            
        # 1. Obtener la URL del módulo de retenciones
        # Necesitamos el HTML de login que guardamos en initialize
        # Como no lo guardamos en self, vamos a intentar obtenerlo de la sesion o re-inicializar si fuera necesario
        # En este caso, SATDoLogin devuelve el html, lo vamos a guardar en self.login_html
        
        menu_ret = SATGetRetentionsUrl(self.session, self.view_state)
        # Reutilizamos el login_html si lo guardamos, o lo buscamos de nuevo
        _, url_ret = menu_ret.execute(login_html=self.login_html)
        
        # 2. Entrar a la página de retenciones para obtener el ViewState de esa página
        r_page = self.session.get(url_ret, timeout=20)
        bs_page = BeautifulSoup(r_page.text, "html.parser")
        
        def get_vs(soup):
            vs = soup.find("input", {"name": "javax.faces.ViewState"})
            return vs["value"] if vs else ""

        # Identificación Dinámica de IDs (Agencia Virtual varía)
        def find_el_by_pattern(soup, patterns):
            for pattern in patterns:
                el = soup.find(["input", "select", "button"], {"id": re.compile(pattern)})
                if el: return el
            return None

        # Patrones comunes en SAT
        el_del = find_el_by_pattern(bs_page, [".*fechaEmisionDel_input", ".*fechaInicio_input", ".*txtFechaDel_input", ".*fechaDel_input"])
        el_al  = find_el_by_pattern(bs_page, [".*fechaEmisionAl_input", ".*fechaFin_input", ".*txtFechaAl_input", ".*fechaAl_input"])
        el_tipo = find_el_by_pattern(bs_page, [".*tipoRetencion_input", ".*comboTipo_input", ".*tipoConstancia_input"])
        # Buscar el botón "Buscar" por nombre, ID o clase
        el_btn = find_el_by_pattern(bs_page, [".*btnBuscar", ".*j_idt.*buscar", ".*j_idt.*Buscar"])
        if not el_btn:
            btn_els = bs_page.find_all(["button", "input"], string=re.compile("Buscar", re.I))
            if not btn_els: btn_els = bs_page.find_all(["button", "input", "a"], {"id": re.compile(".*buscar.*", re.I)})
            if btn_els: el_btn = btn_els[0]

        if not el_del or not el_btn:
            logging.error(f"[RETENSION-SYNC] Faltan elementos críticos. DEL={el_del}, BTN={el_btn}")
            return []

        id_del = el_del["id"]
        id_al = el_al["id"] if el_al else id_del
        id_tipo = el_tipo["id"] if el_tipo else None
        id_btn = el_btn["id"]

        # IMPORTANTE: Encontrar el form que contiene estos elementos
        form = el_del.find_parent("form") or bs_page.find("form", {"id": re.compile(".*")})
        form_id = form["id"] if form else "formBusqueda"

        logging.info(f"[RETENSION-SYNC] Config: FORM={form_id}, DEL={id_del}, BTN={id_btn}")

        results = []
        tipos = ["IVA", "ISR"]
        
        for tipo in tipos:
            vs = get_vs(bs_page)
            
            # GREEDY: Colectar todos los campos del formulario
            post_data = {}
            for tag in form.find_all(["input", "select"]):
                name = tag.get("name")
                if not name: continue
                if tag.get("type") in ["submit", "button"] and name != id_btn: continue
                post_data[name] = tag.get("value", "")

            post_data.update({
                f"{form_id}": form_id,
                "javax.faces.ViewState": vs,
                "javax.faces.partial.ajax": "true",
                "javax.faces.source": id_btn,
                "javax.faces.partial.execute": "@all",
                "javax.faces.partial.render": "@all",
                id_btn: id_btn,
                id_del: date_start.strftime("%d/%m/%Y"),
                id_al: date_end.strftime("%d/%m/%Y"),
            })
            if id_tipo: post_data[id_tipo] = tipo

            headers = {"Faces-Request": "partial/ajax"}
            r_res = self.session.post(url_ret, data=post_data, headers=headers, timeout=20)
            
            # PARSEO ULTRA-RESILIENTE (v5)
            bs_xml = BeautifulSoup(r_res.text, "xml")
            updates = bs_xml.find_all("update")
            if not updates:
                 logging.warning(f"[RETENSION-SYNC] Respuesta sin updates. Status: {r_res.status_code}")
                 continue

            for upd in updates:
                h = upd.text
                if not h: continue
                # Capturar errores explícitos del portal (ej. Sesión expirada o No hay registros)
                if "ui-messages" in h:
                    bs_msg = BeautifulSoup(h, "html.parser")
                    for m_tag in bs_msg.find_all(class_=re.compile("ui-messages-.*-detail")):
                        logging.warning(f"[SAT-PORTAL-MSG] {m_tag.get_text().strip()}")
                
                bs_h = BeautifulSoup(h, "html.parser")
                rows = bs_h.select("tr") 
                for r in rows:
                    cols = r.find_all("td")
                    if len(cols) < 5: continue 
                    
                    txt = r.get_text().lower()
                    # Buscar indicadores de que esta fila es una constancia
                    if "retenedor" in txt or "constancia" in txt or "q" in txt:
                        c = [td.get_text().strip() for td in cols]
                        try:
                            # Heurística: NIT suele ser el 2do elemento, Constancia el 5to, Fecha el 6to, Monto el 8vo
                            # Pero vamos a validar el formato de fecha
                            fecha = None
                            for idx, val in enumerate(c):
                                if re.match(r"\d{2}/\d{2}/\d{4}", val):
                                    fecha = val
                                    fecha_idx = idx
                                    break
                            
                            if not fecha: continue
                            
                            # Si encontramos fecha, asumimos posiciones relativas tipicas:
                            # Constancia suele estar justo antes de la fecha
                            const = c[fecha_idx - 1]
                            # NIT suele estar al inicio (index 1)
                            nit = c[1]
                            nom = c[2]
                            # El monto suele ser el último o penúltimo con una 'Q'
                            monto_s = c[-1].replace("Q", "").replace(",", "").strip()
                            if not monto_s: monto_s = c[-2].replace("Q", "").replace(",", "").strip()
                            
                            monto = float(monto_s)
                            results.append({
                                "nit_emisor": nit, "nombre_emisor": nom, "numero": const, 
                                "fecha": datetime.strptime(fecha, "%d/%m/%Y").strftime("%Y-%m-%d"),
                                "total": monto, "isr_retenido": monto if tipo == "ISR" else 0,
                                "iva_retenido": monto if tipo == "IVA" else 0,
                                "serie": "RET", "tipo_dte": "CRE", "uuid": f"RET-{const}", "estado": "V"
                            })
                        except: continue
                
        # Eliminar duplicados por UUID
        seen = set()
        final_results = []
        for r in results:
            if r["uuid"] not in seen:
                final_results.append(r)
                seen.add(r["uuid"])

        return final_results

    def get_retencion_pdf(self, constancia_number, date_start, date_end, tipo="IVA"):
        """
        Download a specific retention PDF by its number.
        Requires navigating back to the search results first to identify the row.
        """
        if not self.its_initialized:
            self.initialize()
            
        menu_ret = SATGetRetentionsUrl(self.session, self.view_state)
        _, url_ret = menu_ret.execute(login_html=self.login_html)
        
        r_page = self.session.get(url_ret, timeout=20)
        bs_page = BeautifulSoup(r_page.text, "html.parser")
        
        def get_vs(soup):
            vs = soup.find("input", {"name": "javax.faces.ViewState"})
            return vs["value"] if vs else ""
        
        # Identificación Dinámica de IDs
        def find_id_by_pattern(soup, patterns):
            for pattern in patterns:
                el = soup.find(["input", "select", "button"], {"id": re.compile(pattern)})
                if el: return el["id"]
            return None

        id_del = find_id_by_pattern(bs_page, [".*fechaEmisionDel_input", ".*fechaInicio_input", ".*txtFechaDel_input"])
        id_al  = find_id_by_pattern(bs_page, [".*fechaEmisionAl_input", ".*fechaFin_input", ".*txtFechaAl_input"])
        id_tipo = find_id_by_pattern(bs_page, [".*tipoRetencion_input", ".*comboTipo_input"])
        id_btn = find_id_by_pattern(bs_page, [".*btnBuscar", ".*j_idt.*"])
        if not id_btn:
            btn_el = bs_page.find(["button", "input"], string=re.compile("Buscar", re.I))
            if btn_el and btn_el.has_attr("id"): id_btn = btn_el["id"]

        vs = get_vs(bs_page)
        form = bs_page.find("form", {"id": re.compile(".*")})
        if not form or not id_del or not id_al or not id_btn: return None
        form_id = form["id"]
        
        # 1. Realizar busqueda para que el ViewState de la sesión sepa de qué tabla hablamos
        post_data = {
            f"{form_id}": form_id,
            "javax.faces.ViewState": vs,
            "javax.faces.partial.ajax": "true",
            "javax.faces.source": id_btn,
            "javax.faces.partial.execute": "@all",
            "javax.faces.partial.render": f"{form_id}:tablaResultados",
            id_btn: id_btn,
            id_del: date_start.strftime("%d/%m/%Y"),
            id_al: date_end.strftime("%d/%m/%Y")
        }
        if id_tipo:
            post_data[id_tipo] = tipo
        
        headers = {"Faces-Request": "partial/ajax"}
        r_search = self.session.post(url_ret, data=post_data, headers=headers, timeout=20)
        
        # 2. Identificar el ID del botón de descarga de la fila correcta
        bs_res = BeautifulSoup(r_search.text, "xml")
        update_tag = bs_res.find("update")
        if not update_tag: return None
        
        bs_table = BeautifulSoup(update_tag.text, "html.parser")
        rows = bs_table.select("tr.ui-widget-content")
        
        target_source = None
        for i, row in enumerate(rows):
            cols = row.find_all("td")
            if len(cols) < 8: continue
            if cols[4].text.strip() == constancia_number:
                # Encontrar el botón dentro de esta fila
                # Normalmente es un commandLink con un ID que incluye el índice de la fila
                btn = row.find("a", {"id": re.compile(r".*btnPdf")}) or row.find("button", {"id": re.compile(r".*btnPdf")})
                if btn:
                    target_source = btn["id"]
                    break
        
        if not target_source:
             return None
             
        # Obtenemos el ViewState actualizado de la respuesta AJAX
        vs_match = re.search(r'<update id="javax.faces.ViewState"><!\[CDATA\[(.*?)]]>', r_search.text)
        new_vs = vs_match.group(1) if vs_match else vs
        
        # 3. Triger del download (POST con ajax=false o manejando el stream)
        # En PrimeFaces, las descargas suelen ser POSTs normales (no AJAX parcial) que devuelven un file stream
        download_data = {
            f"{form_id}": form_id,
            "javax.faces.ViewState": new_vs,
            target_source: target_source
        }
        
        # Eliminamos el header AJAX para que el servidor entienda que queremos el archivo real
        res = self.session.post(url_ret, data=download_data, timeout=30, stream=True)
        if res.status_code == 200 and 'application/pdf' in res.headers.get('Content-Type', ''):
            return res.content
            
        return None
