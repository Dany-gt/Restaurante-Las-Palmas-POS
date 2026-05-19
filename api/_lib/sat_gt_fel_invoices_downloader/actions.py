import re
import datetime
import logging
from curl_cffi import requests
from bs4 import BeautifulSoup, CData
from urllib.parse import urlencode

TIMEOUT = 20


class SATDoLogin:
    def __init__(self, credentials, request_session):
        self._credentials = credentials
        self._session = request_session
        self._view_state = None

    def execute(self):
        login_url = "https://farm3.sat.gob.gt/menu/login.jsf"
        
        # 1. Configurar headers de identidad humana completa para este POST
        headers = {
            "Origin": "https://farm3.sat.gob.gt",
            "Referer": login_url,
            "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
        }
        
        # 2. Obtener la página de login para extraer el ViewState inicial
        r_get = self._session.get(login_url, timeout=TIMEOUT, headers=headers)
        r_get.raise_for_status()
        
        bs_get = BeautifulSoup(r_get.text, features="html.parser")
        view_state_input = bs_get.find("input", {"name": "javax.faces.ViewState"})
        initial_view_state = view_state_input["value"] if view_state_input else ""

        # 2. Hacer POST con los campos que requiere el formulario JSF
        login_dict = {
            "formContent": "formContent",
            "formContent:username": self._credentials.username,
            "formContent:password": self._credentials.password,
            "formContent:cmdbtnIngresar": "", 
            "javax.faces.ViewState": initial_view_state,
        }
        r = self._session.post(
            login_url, data=login_dict, timeout=TIMEOUT, headers=headers
        )
        r.raise_for_status()
        self._last_html = r.text # Guardamos para diagnóstico interno
        
        bs = BeautifulSoup(r.text, features="html.parser")
        
        # 1. Verificar si hay un mensaje de error explícito de JSF/PrimeFaces
        err_msg = bs.find("span", {"id": "formContent:otMensaje"}) or bs.find(class_="white-error") or bs.find(class_="ui-messages-error")
        if err_msg and err_msg.text.strip():
            logging.error(f"Error de credenciales en login SAT: {err_msg.text.strip()}")
            return (False, None)
            
        # 2. Verificar si contiene el enlace al DTE o si no hay indicador de error en el texto
        if "Consultar DTE" not in r.text and ("inválidas" in r.text or "incorrecto" in r.text or "incorrecta" in r.text):
            logging.error("Error de autenticación: Credenciales incorrectas o portal bloqueado.")
            return (False, None)
            
        view_state = bs.find("input", {"name": "javax.faces.ViewState"})
        if view_state and "value" in view_state.attrs.keys():
            self._view_state = view_state["value"]
            return (True, self._view_state)
            
        return (False, None)


class SATDoLogout:
    def __init__(self, request_session, view_state):
        self._session = request_session
        self.view_state = view_state

    def execute(self):

        form_data = {
            "javax.faces.partial.ajax": True,
            "javax.faces.source: formContent": "j_idt46",
            "javax.faces.partial.execute": "@all",
            "javax.faces.partial.render": "formContent:contentAgenciaVirtual",
            "formContent:j_idt46": "formContent:j_idt46",
            "formContent": "formContent",
            "javax.faces.ViewState": self.view_state,
        }
        r = self._session.post(
            "https://farm3.sat.gob.gt/menu-agenciaVirtual/private/home.jsf",
            data=form_data,
            timeout=3,
        )
        r2 = self._session.post(
            "https://farm3.sat.gob.gt/menu/init.do",
            data={"operacion": "CANCELAR"},
            timeout=3,
        )
        return True

class SATGetMenu:
    def __init__(self, request_session, view_state):
        self._session = request_session
        self._view_state = view_state
        self._url_get_fel = None

    def execute(self, login_html=None):
        import re
        from bs4 import BeautifulSoup
        
        # Si no nos pasan el html, no podemos avanzar
        if not login_html:
             raise Exception("No se proporcionó el HTML de inicio de sesión para procesar el menú")

        parser = BeautifulSoup(login_html, features="html.parser")
        dtelink = None
        for a_tag in parser.find_all("a"):
            if "Consultar DTE" in str(a_tag):
                dtelink = a_tag
                break
                
        if not dtelink or 'onclick' not in dtelink.attrs:
            raise Exception("No se encontró el enlace de consulta DTE")
            
        onclick = dtelink["onclick"]
        
        # Extraer parametros del PrimeFaces.ab(...)
        pa_match = re.search(r'pa:\[(.*?)\]', onclick)
        params = {}
        if pa_match:
            pa_str = pa_match.group(1)
            items = re.findall(r'\{name:"([^"]+)",value:"([^"]+)"\}', pa_str)
            for name, value in items:
                params[name] = value.replace('\\/', '/').replace('\\-', '-')
                
        # source y form
        source_m = re.search(r's:"([^"]+)"', onclick)
        form_m = re.search(r'f:"([^"]+)"', onclick)
        
        source = source_m.group(1) if source_m else "frmMenu:j_idt41"
        formId = form_m.group(1) if form_m else "frmMenu"
        
        # Construir POST de JSF
        post_data = {
            "javax.faces.partial.ajax": "true",
            "javax.faces.source": source,
            "javax.faces.partial.execute": "@all",
            formId: formId,
            "javax.faces.ViewState": self._view_state,
        }
        post_data.update(params)
        
        # Enviar clic AJAX
        headers = {
            "Faces-Request": "partial/ajax",
            "Referer": "https://farm3.sat.gob.gt/menu/portada.jsf",
            "Origin": "https://farm3.sat.gob.gt"
        }
        r = self._session.post(
            "https://farm3.sat.gob.gt/menu/portada.jsf",
            data=post_data,
            headers=headers,
            timeout=TIMEOUT
        )
        
        # Diagnóstico: ¿Qué nos respondió el menú?
        logging.info(f"Respuesta Menú SAT (Status: {r.status_code}): {r.text[:300]}")
        if "challenge-platform" in r.text or "Cloudflare" in r.text:
             logging.error("Cloudflare bloqueó el acceso al menú (JS Challenge).")
             # Intentamos guardar para análisis
             self._last_menu_html = r.text
        
        with open(r"C:\Users\CyR Las Palmas\Documents\Restaurante Las Palmas POS\server\ajax_post.xml", "w", encoding="utf-8") as f:
            f.write(r.text)
        
        logging.getLogger().info("Respuesta de AJAX a portada.jsf: " + r.text[:200])
        
        # Extraer la URL dinámica con las nuevas llaves criptográficas JSF
        target_url = None
        if "location.replace" in r.text:
            m = re.search(r"location\.replace\('([^']+)'\)", r.text)
            if m:
                target_url = m.group(1).replace("&amp;", "&")
                
        if not target_url:
            target_url = params.get("url", "https://felcons.c.sat.gob.gt/dte-agencia-virtual/dte-consulta")
            
        self._url_get_fel = target_url
        return (True, self._url_get_fel)


class SATGetStablisments:
    def __init__(self, request_session):
        self._session = request_session

    def execute(self):
        url = "https://felcons.c.sat.gob.gt/dte-agencia-virtual/api/catalogo/establecimientos"
        cookie = self._session.cookies.get("ACCESS_TOKEN") or self._session.cookies.get("felTokc")
        header = {
            "Authorization": cookie,
            "Accept": "application/json, text/plain, */*",
            "Origin": "https://felcons.c.sat.gob.gt",
            "Referer": "https://felcons.c.sat.gob.gt/dte-agencia-virtual/"
        }
        r = self._session.get(url, headers=header, timeout=TIMEOUT)
        return r.json()
