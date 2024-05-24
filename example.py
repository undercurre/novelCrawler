# example.py
import ddddocr

ocr = ddddocr.DdddOcr()

image = open("captcha.jpg", "rb").read()
result = ocr.classification(image)
print(result)