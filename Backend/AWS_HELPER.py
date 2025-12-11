# aws_helper.py
import boto3  # βιβλιοθήκη για επικοινωνία server-amazon
import os
import logging
from botocore.exceptions import ClientError  # για σφάλματα επικοινωνίας με την amazon

logger = logging.getLogger(__name__)
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)

AWS_ENV_VARS = [
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_REGION",
    "AWS_SES_SENDER_EMAIL",
]


def get_aws_settings():
    missing = []  # έλεγχος για το αν λείπει κάποια παράμετρος από το env αρχείο
    for var in AWS_ENV_VARS:
        if not os.getenv(var):
            missing.append(var)

    if missing:
        raise RuntimeError(f"Λείπουν οι μεταβλητές: {', '.join(missing)}")

    region = os.getenv("AWS_REGION")
    sender = os.getenv("AWS_SES_SENDER_EMAIL")

    return {"region": region, "sender_email": sender}


# φτίαχνει έναν boto3 SES client
def get_ses_client():
    settings = get_aws_settings()
    region = settings.get("region")
    return boto3.client("ses", region_name=region)


def send_email(
    to_email: str, subject: str, body_text: str, body_html: str | None = None
):
    """
    Στέλνει ένα απλό email μέσω AWS SES.
    Επιστρέφει dict με ok True/False και (προαιρετικά) message_id ή error.
    """
    settings = get_aws_settings()
    sender = settings["sender_email"]

    ses = get_ses_client()

    try:
        response = ses.send_email(
            Source=sender,
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": subject},
                "Body": (
                    {"Html": {"Data": body_html}, "Text": {"Data": body_text}}
                    if body_html
                    else {"Text": {"Data": body_text}}
                ),
            },
        )
        msg_id = response.get("MessageId")
        return {"ok": True, "message_id": msg_id}
    except ClientError as e:
        # Μην διαρρέεις μυστικά· επέστρεψε καθαρό μήνυμα λάθους
        err_msg = e.response.get("Error", {}).get("Message", str(e))
        return {"ok": False, "error": err_msg}
