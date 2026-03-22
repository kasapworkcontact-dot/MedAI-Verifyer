import os
import json
from PIL import Image

PROMPT = """You are an expert at reading medical operation checklists written in Thai and English.
Analyze this surgical equipment checklist form image and extract all equipment/instrument names and their quantities.

Return ONLY a valid JSON object in this exact format (no markdown, no explanation):
{
  "equipment": [
    {"name": "equipment_name", "count": 1},
    {"name": "another_item", "count": 3}
  ]
}

Rules:
- Include ALL items with quantities you can see
- If quantity is not clearly written, use 1
- Use English names where possible, keep Thai if unclear
- Return empty list if no equipment found
"""


def ocr_form(image_path: str) -> dict:
    """
    Use Gemini to OCR a surgical checklist form.
    Returns dict: {equipment_name: count}
    """
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key or api_key == "your_gemini_api_key_here":
        # Return mock data if no API key configured
        return {
            "Scalpel": 2,
            "Forceps": 4,
            "Scissor": 2,
            "Retractor": 1,
            "Needle holder": 2,
        }

    try:
        from google import genai

        client = genai.Client(api_key=api_key)
        img = Image.open(image_path)

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[PROMPT, img],
        )
        text = response.text.strip()

        # Clean up if wrapped in markdown code block
        if "```" in text:
            parts = text.split("```")
            text = parts[1] if len(parts) > 1 else parts[0]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()

        data = json.loads(text)
        result = {}
        for item in data.get("equipment", []):
            name = item.get("name", "Unknown")
            count = int(item.get("count", 1))
            result[name] = result.get(name, 0) + count
        return result

    except Exception as e:
        print(f"[GeminiOCR] Error: {e}")
        return {}
