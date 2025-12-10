# source_code.py

import os
from brightdata import client

def get_website_source_code(url,headless=True):
    """
    Κάνει αίτημα στη Bright Data για να πάρει το HTML κείμενο της σελίδας.
    Χρησιμοποιεί Web Unlocker zone/country από μεταβλητές περιβάλλοντος.
    
    Args:
        url: Το URL της σελίδας
        wait_for_dynamic_content_seconds: Ignored (για compatibility με παλιό API)
        headless: Ignored (για compatibility με παλιό API)
        
    Returns:
        str: Το HTML content της σελίδας
    """
    api_key = os.getenv("BRIGHTDATA_API_KEY")
    if not api_key:
        raise ValueError("Λείπει το BRIGHTDATA_API_KEY στο περιβάλλον.")

    try:
        client = client(api_token=api_key)
    except Exception as e:
        raise RuntimeError(f"Σφάλμα αρχικοποίησης Bright Data client: {e}")

    try:
        # Κλήση Bright Data API (ΧΩΡΙΣ format="json" που δίνει error)
        results = client.scrape(
            url=[url],
            timeout=60,
            zone=os.getenv("BD_ZONE", "sdk_unlocker"),
            country=os.getenv("BD_COUNTRY", "gr"),
            method="GET",
        )
    except Exception as e:
        raise RuntimeError(f"Σφάλμα κλήσης Bright Data API: {e}")

    # Χειρισμός response
    # Το Bright Data SDK επιστρέφει: list[str] ή dict με 'results'
    
    if isinstance(results, dict) and "results" in results:
        # Format: {"results": [...]}
        results = results["results"]
    
    if not results:
        raise RuntimeError(f"Bright Data API: Empty response για URL: {url}")
    
    if not isinstance(results, list):
        raise RuntimeError(f"Bright Data API: Unexpected response type: {type(results)}")
    
    first_result = results[0]
    
    # Case 1: Το response είναι απλό HTML string
    if isinstance(first_result, str):
        # Validation ότι μοιάζει με HTML
        if first_result.strip().startswith(("<!DOCTYPE", "<html", "<HTML")):
            return first_result
        else:
            # Μπορεί να είναι HTML χωρίς DOCTYPE
            if "<html" in first_result.lower()[:200]:
                return first_result
            else:
                raise RuntimeError(f"Bright Data API: Response δεν φαίνεται να είναι HTML")
    
    # Case 2: Το response είναι dict με metadata
    elif isinstance(first_result, dict):
        # Έλεγχος status code αν υπάρχει
        status_code = first_result.get("status_code")
        if status_code and status_code != 200:
            error_text = first_result.get("error_message", "Unknown API Error")
            raise RuntimeError(f"Bright Data API error {status_code}: {error_text[:200]}")
        
        # Εξαγωγή HTML από πιθανά fields
        html_content = (
            first_result.get("content") or 
            first_result.get("html") or 
            first_result.get("body")
        )
        
        if not html_content:
            available_keys = list(first_result.keys())
            raise RuntimeError(
                f"Bright Data API: Δεν βρέθηκε HTML content. "
                f"Available keys: {available_keys}"
            )
        
        return html_content
    
    else:
        raise RuntimeError(
            f"Bright Data API: Unexpected item type στο response: {type(first_result)}"
        )
