from markitdown import MarkItDown, StreamInfo
from io import BytesIO
from pathlib import Path
from pydantic import Field

SUPPORTED_EXTENSIONS = {".pdf", ".docx"}


def binary_document_to_markdown(binary_data: bytes, file_type: str) -> str:
    """Converts binary document data to markdown-formatted text."""
    md = MarkItDown()
    file_obj = BytesIO(binary_data)
    stream_info = StreamInfo(extension=file_type)
    result = md.convert(file_obj, stream_info=stream_info)
    return result.text_content


def document_path_to_markdown(
    file_path: str = Field(description="Absolute or relative path to a PDF or DOCX file"),
) -> str:
    """Convert a PDF or DOCX file to markdown-formatted text.

    Reads the file at the given path and converts its contents to markdown.
    Supports .pdf and .docx file formats.

    When to use:
    - When you have a file path to a document and need its content as markdown
    - When you want to extract readable text from a PDF or Word document

    When not to use:
    - When you already have the file contents as bytes (use binary_document_to_markdown instead)
    - For file formats other than .pdf and .docx

    Examples:
    >>> document_path_to_markdown("/docs/report.pdf")
    "# Report Title\\n\\nContent..."
    >>> document_path_to_markdown("/docs/notes.docx")
    "# Notes\\n\\n- Item one..."
    """
    path = Path(file_path)
    extension = path.suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported file type '{extension}'. Must be one of: {', '.join(SUPPORTED_EXTENSIONS)}")
    return binary_document_to_markdown(path.read_bytes(), extension.lstrip("."))
