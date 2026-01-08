from enum import Enum
import keyring
import os
import PIL.Image
import pystray
import threading
import requests
import requests_oauthlib
import webview
import win32gui

class EventSource(Enum):
    QLDT_THOI_KHOA_BIEU = "/qldt/thoi-khoa-bieu/sv"
    QLDT_ASSIGNMENT = "/qldt/assignment/lich/sinh-vien"
    KHAO_THI_LICH_THI = "/khao-thi/lich-thi/lich-thi/sv"
    SLINK_SU_KIEN = "/slink/su-kien/user"

class EventType(str, Enum):
    GENERAL = "Chung"
    CLASS = "Lịch học"
    EXAM = "Lịch thi"
    ASSIGNMENT = "Bài tập"
    MEETING = "Họp lớp"
    PERSONAL = "Cá nhân"
    OTHER = "Khác"

class API:
    BASE_URL = "https://gwdu.ptit.edu.vn"
    CONFIG_URL = f"{BASE_URL}/sso/realms/ptit/.well-known/openid-configuration"
    CLIENT_ID = "ptit-connect"
    SCOPE = ["email", "offline_access", "openid", "profile"]
    TOKEN_KEYS = ["access_token", "refresh_token", "token_type", "expires_in"]

    KEYRING_SERVICE = "ptit-oauth2"
    KEYRING_USERNAME = ""

    def __init__(self):
        response = requests.get(API.CONFIG_URL)
        response.raise_for_status()

        token = API._read_token()

        self._config = response.json()
        self._session = requests_oauthlib.OAuth2Session(client_id=API.CLIENT_ID, scope=API.SCOPE,
                                                        auto_refresh_url=self._config["token_endpoint"],
                                                        auto_refresh_kwargs=dict(client_id=API.CLIENT_ID),
                                                        token=token, token_updater=API._write_token)

        if token is not None:
            self._session.refresh_token(self._config["token_endpoint"])

    @staticmethod
    def _write_token(token):
        keyring.set_password(API.KEYRING_SERVICE, API.KEYRING_USERNAME, token.get("refresh_token"))

    @staticmethod
    def _read_token():
        password = keyring.get_password(API.KEYRING_SERVICE, API.KEYRING_USERNAME)
        return dict(refresh_token=password) if password else None

    def authorize(self):
        if self._session.authorized:
            return True

        authorization_url, _ = self._session.authorization_url(self._config["authorization_endpoint"])
        return authorization_url

    def exchange(self, authorization_response):
        token = self._session.fetch_token(self._config["token_endpoint"],
                                          authorization_response=authorization_response)
        API._write_token(token)

    def fetch_events(self, from_date, to_date):
        events = []
        for source in EventSource:
            endpoint = f"{API.BASE_URL}{source.value}/from/{from_date}/to/{to_date}"
            response = self._session.get(endpoint)
            response.raise_for_status()

            json = response.json()
            if not json["success"]:
                continue

            for data in json["data"]:
                event = dict()
                event["title"] = source.name
                event["start_date"] = data.get("thoiGianBatDau")
                event["end_date"] = data.get("thoiGianKetThuc")

                match source:
                    case EventSource.QLDT_THOI_KHOA_BIEU:
                        event["title"] = (
                            data.get("lopHocPhan", {}).get("hocPhan", {}).get("ten")
                            or data.get("lopHocPhan", {}).get("maHocPhan")
                            or data.get("tenLopHocPhan", "")
                        )
                        event["type"] = EventType.CLASS
                        event["location"] = data.get("phongHoc", "")
                    case EventSource.QLDT_ASSIGNMENT:
                        event["title"] = data.get("noiDung", "")
                        event["type"] = EventType.ASSIGNMENT
                        event["location"] = data.get("tenLopHocPhan", "")
                    case EventSource.KHAO_THI_LICH_THI:
                        event["title"] = ", ".join(
                            (item.get("ten") or "")
                            for item in (data.get("danhSachHocPhan") or [])
                        )
                        event["type"] = EventType.EXAM
                        event["location"] = data.get("phong", {}).get("ma", "")
                    case EventSource.SLINK_SU_KIEN:
                        event["title"] = data.get("tenSuKien", "")
                        event["type"] = EventType(data.get("loaiSuKien"))
                        event["location"] = data.get("diaDiem", "")
                
                events.append(event)
        return events

def on_beforeload(window):
    # Allow OAuthlib to parse http URI
    os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

    # PTIT SSO doesn't have http://127.0.0.1 required
    api: API = window._js_api
    api._session.redirect_uri = window.real_url.replace("127.0.0.1", "localhost")

    # Attach to desktop
    hwnd = window.native.Handle.ToInt64()
    progman = win32gui.FindWindow("Progman", None)

    win32gui.SetParent(hwnd, progman)

    # Set rounded corners
    radius = 20
    rgn = win32gui.CreateRoundRectRgn(0, 0, window.width, window.height, radius, radius)
    win32gui.SetWindowRgn(hwnd, rgn, True)

    # Start system tray
    icon_image = PIL.Image.open("assets/logo.png")
    icon = pystray.Icon("ptit-calendar", icon=icon_image, title="PTIT Calendar",
                        menu=pystray.Menu(
                            pystray.MenuItem("Locked",
                                             lambda: setattr(window.state, "locked", not window.state.locked),
                                             checked=lambda _: window.state.locked),
                            pystray.MenuItem("Quit", lambda: (window.destroy(), icon.stop())),
                        ))
    threading.Thread(target=lambda: icon.run(), daemon=True).start()

    window.show()
    window.events.before_load -= on_beforeload

if __name__ == "__main__":
    window = webview.create_window("PTIT Calendar", width=360, height=480, frameless=True,
                                   hidden=True, easy_drag=False, js_api=API(),
                                   url="assets/index.html")
    window.state.locked = False
    window.events.before_load += on_beforeload
    webview.start()
