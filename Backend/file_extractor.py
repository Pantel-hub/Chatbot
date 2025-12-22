# file_extractor.py
import io
import os
import tempfile
import logging
from typing import List
from fastapi import UploadFile
from unstructured.partition.auto import partition
import time

logger = logging.getLogger(__name__)

# Configuration
MAX_FILE_SIZE = 1 * 1024 * 1024  # 1MB


def extract_text_from_file_content(file_content: bytes, filename: str) -> str:
    """
    Extract text from file content using Unstructured library.

    Args:
        file_content: File content as bytes
        filename: Original filename for type detection

    Returns:
        Extracted text content
    """
    try:
        start_time = time.time()
        # Create temporary file since Unstructured works with file paths
        with tempfile.NamedTemporaryFile(
            delete=False, suffix=os.path.splitext(filename)[1]
        ) as temp_file:
            temp_file.write(file_content)
            temp_file_path = temp_file.name

        try:
            # Use Unstructured to partition the document
            elements = partition(filename=temp_file_path, languages=["ell", "eng"])
            # Μετρητές
            duration = time.time() - start_time
            table_count = sum(
                1
                for element in elements
                if hasattr(element, "category")
                and getattr(element, "category", "") == "Table"
            )
            element_count = len(elements)
            # Logging στα ελληνικά
            logger.info(
                f"Αρχείο {filename}: {duration:.2f}s, {element_count} στοιχεία, {table_count} πίνακες"
            )

            # Extract text from all elements
            text_content = []
            for element in elements:
                text_content.append(element.text)

            extracted_text = "\n".join(text_content).strip()

            if not extracted_text:
                return f"[No text content found in {filename}]"

            return extracted_text

        finally:
            # Clean up temporary file
            try:
                os.unlink(temp_file_path)
            except OSError:
                pass

    except Exception as e:
        logger.error(f"Error extracting text from {filename}: {e}")
        return f"[Text extraction failed for {filename}: {str(e)}]"


async def extract_text_from_files(files: List[UploadFile]) -> str:
    """
    Extract text from multiple uploaded files using Unstructured library.

    Args:
        files: List of FastAPI UploadFile objects

    Returns:
        Combined text content from all files
    """
    if not files:
        logger.info("No files provided for text extraction")
        return ""

    combined_text = []

    for file in files:
        if not file.filename:
            logger.warning("File with no filename found, skipping")
            continue

        try:
            # Read file content
            content = await file.read()

            # Check file size
            if len(content) > MAX_FILE_SIZE:
                logger.warning(
                    f"File {file.filename} too large ({len(content)} bytes), skipping"
                )
                combined_text.append(
                    f"[File {file.filename} too large (max {MAX_FILE_SIZE//1024//1024}MB), skipped]"
                )
                continue

            # Skip empty files
            if len(content) == 0:
                logger.warning(f"File {file.filename} is empty, skipping")
                combined_text.append(f"[File {file.filename} is empty, skipped]")
                continue

            logger.info(f"Processing file: {file.filename} ({len(content)} bytes)")

            # Extract text using Unstructured
            extracted_text = extract_text_from_file_content(content, file.filename)

            # Add file separator and content
            file_section = f"\n=== ΑΡΧΕΙΟ: {file.filename} ===\n{extracted_text}"
            combined_text.append(file_section)

            logger.info(
                f"Successfully extracted text from {file.filename} ({len(extracted_text)} characters)"
            )

        except Exception as e:
            error_msg = f"[Error processing {file.filename}: {str(e)}]"
            combined_text.append(f"\n=== ΑΡΧΕΙΟ: {file.filename} ===\n{error_msg}")
            logger.error(f"Error processing file {file.filename}: {e}")

    result = "\n".join(combined_text)
    logger.info(f"Text extraction completed. Total characters: {len(result)}")

    return result


def get_supported_formats():
    """
    Return list of supported file formats by Unstructured.
    This is informational - Unstructured handles format detection automatically.
    """
    return [
        "PDF",
        "DOCX",
        "DOC",
        "PPTX",
        "PPT",
        "XLSX",
        "XLS",
        "TXT",
        "CSV",
        "TSV",
        "HTML",
        "XML",
        "RTF",
        "ODT",
        "EML",
        "MSG",
        "EPUB",
        "MD",
        "ORG",
        "RST",
        "JSON",
        "YAML",
    ]
