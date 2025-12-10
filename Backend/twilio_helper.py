# twilio_helper.py
import os
from twilio.rest import Client
from dotenv import load_dotenv

load_dotenv()

# Twilio credentials
TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN')
TWILIO_SENDER_ID = os.getenv('TWILIO_SENDER_ID', 'chatbuilder')


def send_sms(phone_number: str, message_body: str) -> dict:
    try:
        if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
            return {
                "ok": False,
                "error": "Twilio credentials not configured"
            }
        if not phone_number.startswith('+'):
            return {
                "ok": False,
                "error": "Phone number must be in international format (e.g., +306912345678)"
            }
        
        #initialize twilio client
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

        message = client.messages.create(
            body=message_body, # otp_code
            from_=TWILIO_SENDER_ID,  # Alphanumeric Sender ID
            to=phone_number
        )

        print(f"✅ SMS sent to {phone_number} (SID: {message.sid})")
        
        return {
            "ok": True,
            "message_sid": message.sid,
            "status": message.status
        }

    except Exception as e:
        print(f"❌ SMS sending failed: {str(e)}")
        return {
            "ok": False,
            "error": str(e)
        }
        
