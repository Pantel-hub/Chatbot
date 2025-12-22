from bs4 import BeautifulSoup, Comment

# HTML5 void elements (tags that don't need a closing tag and can't have content)
VOID_ELEMENTS = {
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
}


def clean_html_for_content(
    html_content,
    remove_scripts_styles=True,
    remove_comments=True,
    remove_class_and_id=True,
    remove_event_handlers=True,
    remove_data_attributes=True,  # Flag to control removal of data-* attributes
    remove_empty_tags_except_void=True,
    allowed_attributes=None,
    additional_tags_to_remove=None,
    keep_inline_styles_on_specific_tags=None,
):
    """
    Cleans HTML content to retain core textual and structural information.

    Args:
        html_content (str): The HTML string to clean.
        remove_scripts_styles (bool): If True, remove <script> and <style> tags.
        remove_comments (bool): If True, remove HTML comments (including <!-- ko -->).
        remove_class_and_id (bool): If True, remove 'class' and 'id' attributes.
        remove_event_handlers (bool): If True, remove 'on*' event handler attributes.
        remove_data_attributes (bool): If True, remove all attributes starting with 'data-'
                                       (e.g., 'data-bind', 'data-toggle').
        remove_empty_tags_except_void (bool): If True, remove tags that become empty
                                             unless they are void elements.
        allowed_attributes (set, optional): A set of attributes to ALWAYS keep.
                                            Defaults to {'href', 'src', 'alt', 'title', 'colspan', 'rowspan'}.
        additional_tags_to_remove (list, optional): A list of additional tag names to
                                                    completely remove.
        keep_inline_styles_on_specific_tags (dict, optional):
            A dictionary to preserve specific CSS properties from inline 'style' attributes
            for certain tags. E.g., {'span': ['color', 'font-weight']}

    Returns:
        str: The cleaned HTML string.
    """
    soup = BeautifulSoup(html_content, "lxml")

    if allowed_attributes is None:
        allowed_attributes = {"href", "src", "alt", "title", "colspan", "rowspan"}
    if keep_inline_styles_on_specific_tags is None:
        keep_inline_styles_on_specific_tags = {}

    # 1. Remove completely unwanted elements
    tags_to_decompose = []
    if remove_scripts_styles:
        tags_to_decompose.extend(["script", "style"])
    if additional_tags_to_remove:
        tags_to_decompose.extend(additional_tags_to_remove)

    for tag_name in tags_to_decompose:
        for tag in soup.find_all(tag_name):
            tag.decompose()

    # 2. Remove CSS link tags
    if remove_scripts_styles:
        for link_tag in soup.find_all("link", rel="stylesheet"):
            link_tag.decompose()

    # 3. Remove HTML comments
    if remove_comments:
        for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
            comment.extract()

    # 4. Clean attributes from all remaining tags
    for tag in soup.find_all(True):
        attrs_to_delete = []
        for attr_name, attr_value in list(tag.attrs.items()):  # Iterate over a copy
            if attr_name in allowed_attributes:
                continue

            if remove_class_and_id and attr_name in ["class", "id"]:
                attrs_to_delete.append(attr_name)
                continue

            if remove_event_handlers and attr_name.startswith("on"):
                attrs_to_delete.append(attr_name)
                continue

            if remove_data_attributes and attr_name.startswith(
                "data-"
            ):  # This handles 'data-bind'
                attrs_to_delete.append(attr_name)
                continue

            if attr_name == "style":
                if tag.name in keep_inline_styles_on_specific_tags:
                    props_to_keep_for_tag = keep_inline_styles_on_specific_tags[
                        tag.name
                    ]
                    current_styles = {}
                    try:
                        style_declarations = [
                            s.strip() for s in attr_value.split(";") if s.strip()
                        ]
                        for decl in style_declarations:
                            if ":" in decl:
                                parts = decl.split(":", 1)
                                # Safety check: ensure we got exactly 2 parts and both are non-empty
                                if (
                                    len(parts) == 2
                                    and parts[0].strip()
                                    and parts[1].strip()
                                ):
                                    prop, val = parts
                                    current_styles[prop.strip().lower()] = val.strip()
                                # Skip malformed CSS declarations silently
                    except ValueError:
                        attrs_to_delete.append(attr_name)
                        continue

                    kept_styles_list = []
                    for prop, val in current_styles.items():
                        if prop in props_to_keep_for_tag:
                            kept_styles_list.append(f"{prop}: {val}")

                    if kept_styles_list:
                        tag["style"] = "; ".join(kept_styles_list) + ";"
                    else:
                        attrs_to_delete.append(attr_name)
                else:
                    attrs_to_delete.append(attr_name)
                continue

            if attr_name not in allowed_attributes:
                attrs_to_delete.append(attr_name)

        for attr_to_del in attrs_to_delete:
            if tag.has_attr(attr_to_del):
                del tag[attr_to_del]

    # 5. Optionally remove tags that are now empty and not void elements
    if remove_empty_tags_except_void:
        for tag in list(soup.find_all(True)):  # Iterate over a copy if decomposing
            if tag.name in VOID_ELEMENTS:
                continue

            # Check if tag is still in the soup (might have been decomposed if it was a child of another removed empty tag)
            if not tag.parent:
                continue

            has_meaningful_attrs = any(attr in tag.attrs for attr in allowed_attributes)
            is_empty_text = not tag.get_text(strip=True)

            has_significant_children = False
            for child in tag.children:
                if child.name:
                    has_significant_children = True
                    break
                elif isinstance(child, str) and child.strip():
                    has_significant_children = True
                    break

            if (
                is_empty_text
                and not has_significant_children
                and not has_meaningful_attrs
            ):
                is_paragraph_with_only_br = (
                    tag.name == "p"
                    and len(
                        list(
                            c
                            for c in tag.children
                            if c.name or (isinstance(c, str) and c.strip())
                        )
                    )
                    == len(tag.find_all("br", recursive=False))
                    and len(tag.find_all("br", recursive=False)) > 0
                )
                if not is_paragraph_with_only_br:
                    tag.decompose()

    return soup.prettify()

