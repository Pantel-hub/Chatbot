import os
import json
import pymysql
import logging
import asyncio
from typing import Dict, List, Optional
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

from database_connection import get_db

logger = logging.getLogger(__name__)


class GoogleCalendarHelper:
    def __init__(self, api_key: str | None = None):
        self.api_key = api_key
        self.SCOPES = [
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/calendar.events",
        ]
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        self.credentials_file = os.path.join(BASE_DIR, "credentials.json")
        self.redirect_uri = "http://localhost:8000/oauth2callback"

    def get_auth_url(self) -> str:
        if not os.path.exists(self.credentials_file):
            logger.error(f"credentials.json not found at {self.credentials_file}")
            raise FileNotFoundError(
                "Google Calendar credentials.json file is missing. Please configure Google OAuth credentials."
            )

        flow = Flow.from_client_secrets_file(
            self.credentials_file,
            scopes=self.SCOPES,
            redirect_uri=self.redirect_uri,
        )
        auth_url, _ = flow.authorization_url(
            prompt="consent",
            access_type="offline",
            include_granted_scopes="true",
            state=self.api_key,
        )
        return auth_url

    async def _load_settings_from_db(self):
        try:
            async with get_db() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(
                        "SELECT appointment_settings FROM companies WHERE api_key = %s",
                        (self.api_key,),
                    )
                    row = await cur.fetchone()

            if not row or not row[0]:
                return {}

            try:
                return json.loads(row[0])
            except Exception:
                logger.warning(
                    f"Invalid JSON in appointment_settings for api_key={self.api_key}"
                )
                return {}
        except Exception as e:
            logger.error(
                f"DB error in _load_settings_from_db for api_key={self.api_key}: {e}"
            )
            return {}

    def get_credentials_from_code(self, code: str):
        try:
            flow = Flow.from_client_secrets_file(
                self.credentials_file,
                scopes=self.SCOPES,
                redirect_uri=self.redirect_uri,
            )
            flow.fetch_token(code=code)
            return flow.credentials
        except Exception as e:
            print("Error getting credentials:", e)
            return None

    async def save_credentials_to_db(self, credentials) -> bool:
        if not self.api_key:
            return False
        try:
            creds_data = {
                "token": credentials.token,
                "refresh_token": credentials.refresh_token,
                "token_uri": credentials.token_uri,
                "client_id": credentials.client_id,
                "client_secret": credentials.client_secret,
                "scopes": list(credentials.scopes or []),
            }
            async with get_db() as conn:
                async with conn.cursor() as cursor:
                    await cursor.execute(
                        "UPDATE companies SET google_credentials = %s WHERE api_key = %s",
                        (json.dumps(creds_data), self.api_key),
                    )
                    rows_affected = cursor.rowcount
                await conn.commit()
            return rows_affected == 1
        except Exception as e:
            print("Error saving credentials:", e)
            return False

    async def load_credentials(self):
        if not self.api_key:
            return None
        try:
            async with get_db() as conn:
                async with conn.cursor() as cursor:
                    await cursor.execute(
                        "SELECT google_credentials FROM companies WHERE api_key = %s",
                        (self.api_key,),
                    )
                    row = await cursor.fetchone()
        except Exception as e:
            logger.error(
                f"DB error while loading credentials (api_key={self.api_key}): {e}"
            )
            return None
        if not row:
            return None
        creds_json = row.get("google_credentials") if isinstance(row, dict) else row[0]
        if not creds_json:
            return None
        try:
            data = json.loads(creds_json)
            return Credentials(
                token=data.get("token"),
                refresh_token=data.get("refresh_token"),
                token_uri=data.get("token_uri"),
                client_id=data.get("client_id"),
                client_secret=data.get("client_secret"),
                scopes=data.get("scopes") or self.SCOPES,
            )
        except Exception as e:
            print("Error loading credentials:", e)
            return None

    def _get_calendar_id(self, service, settings: dict | None) -> str:
        try:
            settings = settings or {}
            user_calendar_id = (settings.get("calendar_id") or "").strip()
            if user_calendar_id:
                return user_calendar_id
            calendars = service.calendarList().list().execute().get("items", [])
            for cal in calendars:
                if cal.get("summary") == "Bot_Bookings":
                    cid = cal["id"]
                    settings["calendar_id"] = cid
                    return cid
            new_cal = {
                "summary": "Bot_Bookings",
                "timeZone": settings.get("timeZone", "Europe/Athens"),
            }
            created = service.calendars().insert(body=new_cal).execute()
            cid = created["id"]
            settings["calendar_id"] = cid
            return cid
        except Exception as e:
            print("Error in _get_calendar_id:", e)
            return "primary"

    async def _get_duration_minutes(self, settings: dict | None) -> int:
        settings = settings or {}
        if not settings.get("calendar_id"):
            service = await self.get_calendar_service()
            # Run the blocking _get_calendar_id in a thread pool
            settings["calendar_id"] = await asyncio.to_thread(
                self._get_calendar_id, service, settings
            )
        try:
            dur = settings.get("slotDuration")
            return int(dur or 30)
        except Exception:
            return 30

    def _get_tz(self, settings: dict | None) -> ZoneInfo:
        tz_name = (settings or {}).get("timeZone") or "Europe/Athens"
        try:
            return ZoneInfo(tz_name)
        except Exception:
            return ZoneInfo("Europe/Athens")

    async def get_calendar_service(self):
        try:
            creds = await self.load_credentials()
            if not creds:
                return None
            if creds.expired and creds.refresh_token:
                # Run the blocking refresh in a thread pool
                await asyncio.to_thread(creds.refresh, Request())
                try:
                    await self.save_credentials_to_db(creds)
                except Exception:
                    pass
            # Run the blocking build in a thread pool
            return await asyncio.to_thread(
                build, "calendar", "v3", credentials=creds, cache_discovery=False
            )
        except Exception as e:
            print("Error creating calendar service:", e)
            return None

    def _overlaps(a_start, a_end, b_start, b_end) -> bool:
        return a_start < b_end and a_end > b_start

    def _list_events(
        self, service, calendar_id: str, tmin_iso: str, tmax_iso: str
    ) -> list:
        try:
            resp = (
                service.events()
                .list(
                    calendarId=calendar_id,
                    timeMin=tmin_iso,
                    timeMax=tmax_iso,
                    singleEvents=True,
                    orderBy="startTime",
                )
                .execute()
            )
            return resp.get("items", [])
        except Exception as e:
            print("Error listing events:", e)
            return []

    async def get_available_slots(self, date: str, appointment_settings: dict = None):
        try:
            service = await self.get_calendar_service()
            if not service:
                return []
            if appointment_settings is None:
                appointment_settings = await self._load_settings_from_db()
            settings = {
                "workStart": "09:00",
                "workEnd": "17:00",
                "slotDuration": 30,
                "workDays": ["Mon", "Tue", "Wed", "Thu", "Fri"],
                "maxAppointmentsPerSlot": 1,
                "mode": "bot_managed",
                "calendar_id": None,
                "timeZone": "Europe/Athens",
                **(appointment_settings or {}),
            }
            mode = settings.get("mode", "bot_managed")
            tz = self._get_tz(settings)
            day = datetime.strptime(date, "%Y-%m-%d")
            day = datetime(day.year, day.month, day.day, tzinfo=tz)
            weekday = day.strftime("%a")
            if weekday not in settings.get(
                "workDays", ["Mon", "Tue", "Wed", "Thu", "Fri"]
            ):
                return []
            if not settings.get("calendar_id"):
                # Run the blocking _get_calendar_id in a thread pool
                settings["calendar_id"] = await asyncio.to_thread(
                    self._get_calendar_id, service, settings
                )
                async with get_db() as conn:
                    async with conn.cursor() as cursor:
                        await cursor.execute(
                            "UPDATE companies SET appointment_settings = %s WHERE api_key = %s",
                            (json.dumps(settings), self.api_key),
                        )
                    await conn.commit()
            calendar_id = settings["calendar_id"]
            work_start_time = datetime.strptime(settings["workStart"], "%H:%M").time()
            work_end_time = datetime.strptime(settings["workEnd"], "%H:%M").time()
            slot_duration = await self._get_duration_minutes(settings)
            start_local = day.replace(
                hour=work_start_time.hour,
                minute=work_start_time.minute,
                second=0,
                microsecond=0,
            )
            end_local = day.replace(
                hour=work_end_time.hour,
                minute=work_end_time.minute,
                second=0,
                microsecond=0,
            )
            # Run the blocking _list_events in a thread pool
            events = await asyncio.to_thread(
                self._list_events,
                service,
                calendar_id,
                start_local.isoformat(),
                end_local.isoformat(),
            )
            available = []
            current = start_local
            while current + timedelta(minutes=slot_duration) <= end_local:
                slot_end = current + timedelta(minutes=slot_duration)
                slot_bookings = 0
                for e in events:
                    event_start_str = e["start"].get("dateTime")
                    event_end_str = e["end"].get("dateTime")
                    if not event_start_str or not event_end_str:
                        continue
                    event_start = datetime.fromisoformat(
                        event_start_str.replace("Z", "+00:00")
                    )
                    event_end = datetime.fromisoformat(
                        event_end_str.replace("Z", "+00:00")
                    )
                    if event_start.tzinfo != tz:
                        event_start = event_start.astimezone(tz)
                    if event_end.tzinfo != tz:
                        event_end = event_end.astimezone(tz)
                    if current < event_end and slot_end > event_start:
                        slot_bookings += 1
                if slot_bookings < settings.get("maxAppointmentsPerSlot", 1):
                    available.append(
                        {
                            "start_time": current.strftime("%H:%M"),
                            "end_time": slot_end.strftime("%H:%M"),
                            "datetime": current.isoformat(),
                        }
                    )
                current += timedelta(minutes=slot_duration)
            logger.info(
                f"Events: {len(events)} | Slots: {len(available)} | Date: {date} | Mode: {mode} | Calendar: {calendar_id}"
            )
            return available
        except Exception as e:
            logger.error(f"Error getting available slots: {e}")
            import traceback

            traceback.print_exc()
            return []

    async def create_event(
        self,
        title: str,
        description: str,
        start_datetime: str,
        duration_minutes: int = 60,
        attendee_email: str | None = None,
        location: str | None = None,
        time_zone: str | None = None,
        appointment_settings: dict | None = None,
    ) -> str | None:
        try:
            service = await self.get_calendar_service()
            if not service:
                logger.warning("Calendar service unavailable")
                return None
            settings = appointment_settings or {}
            mode = settings.get("mode", "bot_managed")

            # Get calendar_id - run blocking call in thread pool
            calendar_id = await asyncio.to_thread(
                self._get_calendar_id, service, settings
            )

            if mode == "bot_managed":
                try:
                    async with get_db() as conn:
                        async with conn.cursor() as cursor:
                            await cursor.execute(
                                "UPDATE companies SET appointment_settings = %s WHERE api_key = %s",
                                (json.dumps(settings), self.api_key),
                            )
                        await conn.commit()
                except Exception as e:
                    logger.error(f"Failed to update appointment_settings: {e}")
            tz_name = time_zone or settings.get("timeZone") or "Europe/Athens"
            tz = ZoneInfo(tz_name)
            start_dt = datetime.fromisoformat(start_datetime)
            if start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=tz)
            end_dt = start_dt + timedelta(minutes=duration_minutes)
            event = {
                "summary": title,
                "description": description or "",
                "location": location or "",
                "start": {"dateTime": start_dt.isoformat(), "timeZone": tz_name},
                "end": {"dateTime": end_dt.isoformat(), "timeZone": tz_name},
            }
            if attendee_email:
                event["attendees"] = [{"email": attendee_email}]

            # Run the blocking Google API call in a thread pool
            created = await asyncio.to_thread(
                lambda: service.events()
                .insert(calendarId=calendar_id, body=event)
                .execute()
            )
            return {"id": created.get("id"), "htmlLink": created.get("htmlLink")}
        except Exception as e:
            print("Error creating event:", e)
            return None
