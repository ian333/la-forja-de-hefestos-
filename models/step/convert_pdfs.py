from pdf2image import convert_from_path
import os

pdf_dir_d2mi = '/home/ian/Orkesta/la-forja/models/step/NIST-D2MI-Models'
pdf_dir_pmi = '/home/ian/Orkesta/la-forja/models/step/NIST-PMI-STEP-Files/PDF'
out_dir = '/home/ian/Orkesta/la-forja/models/step/pdf-images'

os.makedirs(out_dir, exist_ok=True)

for pdf in sorted(os.listdir(pdf_dir_d2mi)):
    if pdf.endswith('.pdf') and not pdf.startswith('NIST.GCR'):
        path = os.path.join(pdf_dir_d2mi, pdf)
        name = pdf.replace('.pdf','')
        print(f'Converting {pdf}...')
        try:
            images = convert_from_path(path, first_page=1, last_page=1, dpi=150)
            images[0].save(os.path.join(out_dir, f'{name}.png'), 'PNG')
            print(f'  -> {name}.png')
        except Exception as e:
            print(f'  ERROR: {e}')

for pdf in sorted(os.listdir(pdf_dir_pmi)):
    if pdf.endswith('.pdf'):
        path = os.path.join(pdf_dir_pmi, pdf)
        name = pdf.replace('.pdf','')
        print(f'Converting {pdf}...')
        try:
            images = convert_from_path(path, first_page=1, last_page=1, dpi=150)
            images[0].save(os.path.join(out_dir, f'{name}.png'), 'PNG')
            print(f'  -> {name}.png')
        except Exception as e:
            print(f'  ERROR: {e}')

print('DONE')
