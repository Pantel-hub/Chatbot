"""
Link Discovery Module
Extracts and processes links from HTML content using BeautifulSoup.
No Selenium required - works with HTML from Bright Data.

Filtering Strategy:
- KEEP: Internal HTML pages only
- REJECT: Media files, documents, external links, pseudo-links
"""

import re
from typing import List, Dict, Optional
from urllib.parse import urljoin, urlparse, urlunparse
from bs4 import BeautifulSoup


def _normalize_url(url: str) -> str:
    """Normalize URL by adding protocol if missing."""
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url


def _is_valid_url(url: str) -> bool:
    """Check if URL is valid and not a pseudo-link."""
    # Reject pseudo-links
    if not url or url.startswith(
        ("javascript:", "mailto:", "tel:", "sms:", "whatsapp:")
    ):
        return False

    # Reject standalone fragments
    if url == "#" or url.startswith("#"):
        return False

    try:
        parsed = urlparse(url)
        return bool(parsed.netloc or parsed.path)
    except Exception:
        return False


def _clean_and_resolve_url(link_url: str, base_url: str) -> Optional[str]:
    """Clean and resolve relative URLs to absolute URLs."""
    if not _is_valid_url(link_url):
        return None

    try:
        # Resolve relative URLs
        absolute_url = urljoin(base_url, link_url)

        # Parse and clean the URL
        parsed = urlparse(absolute_url)

        # Remove fragment (everything after #)
        cleaned_url = urlunparse(
            (
                parsed.scheme,
                parsed.netloc,
                parsed.path,
                parsed.params,
                parsed.query,
                "",  # Remove fragment
            )
        )

        return cleaned_url
    except Exception as e:
        print(f"Error cleaning URL '{link_url}': {e}")
        return None


def _should_reject_url(url: str) -> tuple[bool, str]:
    """
    Check if URL should be rejected based on file extension.

    Returns:
        tuple: (should_reject, reason)
    """
    reject_patterns = {
        "media_image": r"\.(jpg|jpeg|png|gif|bmp|svg|ico|webp|tiff|heic|heif)$",
        "media_video": r"\.(mp4|avi|mov|wmv|flv|webm|mkv|mpeg|mpg)$",
        "media_audio": r"\.(mp3|wav|ogg|m4a|flac|aac|wma)$",
        "archive": r"\.(zip|rar|tar|gz|7z|bz2|xz)$",
        "font": r"\.(woff|woff2|ttf|eot|otf)$",
        "document": r"\.(pdf|doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp)$",
        "data": r"\.(json|xml|csv|sql|sh|bat|exe|dmg|pkg)$",
    }

    for reason, pattern in reject_patterns.items():
        if re.search(pattern, url, re.IGNORECASE):
            return True, reason

    return False, ""


def _filter_links(
    links: List[str], base_domain: str, include_external: bool = False
) -> tuple[List[str], Dict[str, int]]:
    """
    Filter links based on domain and file type.

    Returns:
        tuple: (filtered_links, rejection_stats)
    """
    filtered_links = []
    rejection_stats = {
        "external": 0,
        "media_image": 0,
        "media_video": 0,
        "media_audio": 0,
        "archive": 0,
        "font": 0,
        "document": 0,
        "data": 0,
        "error": 0,
    }

    for link in links:
        try:
            parsed = urlparse(link)
            link_domain = parsed.netloc.lower()

            # Check if it's external
            if not include_external and link_domain != base_domain:
                rejection_stats["external"] += 1
                print(f"  ❌ External: {link}")
                continue

            # Check if should be rejected by pattern
            should_reject, reason = _should_reject_url(link)
            if should_reject:
                rejection_stats[reason] += 1
                print(f"  ❌ {reason}: {link}")
                continue

            # KEEP this link
            filtered_links.append(link)
            print(f"  ✅ Kept: {link}")

        except Exception as e:
            rejection_stats["error"] += 1
            print(f"  ⚠️ Error filtering link '{link}': {e}")
            continue

    return filtered_links, rejection_stats


def get_links_from_html(
    html_content: str, base_url: str, include_external: bool = False
) -> Dict[str, any]:
    """
    Extract all links from HTML content.

    Args:
        html_content: The HTML content to parse (from Bright Data)
        base_url: The base URL for resolving relative links
        include_external: Whether to include external domain links (default: False)

    Returns:
        Dictionary containing:
        - 'success': Boolean indicating if extraction was successful
        - 'links': List of extracted URLs
        - 'total_found': Total number of links found before filtering
        - 'base_url': The base URL that was used
        - 'error': Error message if extraction failed
        - 'rejection_stats': Dictionary with rejection reasons and counts
    """
    base_url = _normalize_url(base_url)
    base_domain = urlparse(base_url).netloc.lower()

    result = {
        "success": False,
        "links": [],
        "total_found": 0,
        "base_url": base_url,
        "error": None,
        "rejection_stats": {},
    }

    try:
        # Parse HTML with BeautifulSoup
        print(f"LinkDiscovery: Parsing HTML for '{base_url}'...")
        soup = BeautifulSoup(html_content, "html.parser")

        # Find all anchor tags
        link_elements = soup.find_all("a", href=True)
        raw_links = []

        print(f"LinkDiscovery: Found {len(link_elements)} <a href> tags")

        for element in link_elements:
            try:
                href = element.get("href")
                if href:
                    cleaned_url = _clean_and_resolve_url(href, base_url)
                    if cleaned_url:
                        raw_links.append(cleaned_url)
            except Exception as e:
                print(f"Error processing link element: {e}")
                continue

        # Remove duplicates while preserving order
        unique_links = list(dict.fromkeys(raw_links))
        result["total_found"] = len(unique_links)

        print(
            f"LinkDiscovery: Found {len(unique_links)} unique links after deduplication"
        )
        print(
            f"LinkDiscovery: Starting filtering (include_external={include_external})..."
        )

        # Filter links
        filtered_links, rejection_stats = _filter_links(
            unique_links, base_domain, include_external
        )

        result["links"] = filtered_links
        result["rejection_stats"] = rejection_stats
        result["success"] = True

        print(f"\nLinkDiscovery: === SUMMARY ===")
        print(f"  Total <a> tags: {len(link_elements)}")
        print(f"  Unique URLs: {len(unique_links)}")
        print(f"  Kept: {len(filtered_links)}")
        print(f"  Rejected: {len(unique_links) - len(filtered_links)}")
        print(f"  Rejection breakdown:")
        for reason, count in rejection_stats.items():
            if count > 0:
                print(f"    - {reason}: {count}")

    except Exception as e:
        error_msg = f"Error parsing HTML for '{base_url}': {str(e)}"
        print(f"LinkDiscovery: {error_msg}")
        result["error"] = error_msg

    return result


def get_detailed_links_info(
    html_content: str, base_url: str, include_external: bool = False
) -> Dict[str, any]:
    """
    Get detailed information about links extracted from HTML content.

    This is a convenience wrapper around get_links_from_html().

    Args:
        html_content: The HTML content to parse
        base_url: The base URL for resolving relative links
        include_external: Whether to include external links (default: False)

    Returns:
        Detailed dictionary with extraction results
    """
    return get_links_from_html(
        html_content=html_content, base_url=base_url, include_external=include_external
    )
