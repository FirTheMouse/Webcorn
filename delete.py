import re
import sys

STATE_IDS = {
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
}

DISTRICT_IDS = {"CO-08", "CA-22", "FL-27", "IA-02", "NC-01", "NY-17", 
                "PA-08", "TX-15", "AL-02", "FL-22", "AZ-02", "VA-01", 
                "MI-04", "TX-35"}

def parse_style(style_str):
    props = {}
    for part in style_str.split(";"):
        part = part.strip()
        if ":" in part:
            k, v = part.split(":", 1)
            props[k.strip()] = v.strip()
    return props

def extract_attr(tag_str, attr):
    match = re.search(rf'(?<!\w){attr}="([^"]*)"', tag_str)
    return match.group(1) if match else ""

def convert_path(tag_str):
    pid   = extract_attr(tag_str, "id")
    d     = extract_attr(tag_str, "d")
    name  = extract_attr(tag_str, "data-name")
    style = extract_attr(tag_str, "style")

    lines = ['path {']
    if pid:   lines.append(f'    "id" : "{pid}";')
    if name:  lines.append(f'    "data-name" : "{name}";')
    if d:     lines.append(f'    "d" : "{d}";')

    if style:
        for k, v in parse_style(style).items():
            lines.append(f'    "{k}" : "{v}";')

    lines.append('}')
    return "\n".join(lines)

def process(filepath, target_ids):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Pull out all <path ...> tags (handles multiline)
    tags = re.findall(r'<path\b[^>]*/>', content, re.DOTALL)
    
    results = []
    for tag in tags:
        pid = extract_attr(tag, "id")
        if pid in target_ids:
            results.append(convert_path(tag))
    
    return results

if __name__ == "__main__":
    state_results    = process("web/us.svg", STATE_IDS)
    # district_results = process("us_districts.svg", DISTRICT_IDS)

    print("// === STATES ===")
    for r in state_results:
        print(r)
        print()

    # print("// === DISTRICTS ===")
    # for r in district_results:
    #     print(r)
    #     print()