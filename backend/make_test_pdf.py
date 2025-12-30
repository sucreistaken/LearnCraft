import fitz

doc = fitz.open()
page = doc.new_page()
page.insert_text((100, 100), "Hello World! This is a test slide.")
doc.save("test_ocr.pdf")
print("test_ocr.pdf created")
