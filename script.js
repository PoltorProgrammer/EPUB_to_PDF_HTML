class EPUBtoPDFConverter {
    constructor() {
        this.selectedFile = null;
        this.pdfData = null;
        this.htmlData = null;
        this.initializeElements();
        this.attachEventListeners();
    }

    initializeElements() {
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.fileInfo = document.getElementById('fileInfo');
        this.fileName = document.getElementById('fileName');
        this.fileSize = document.getElementById('fileSize');
        this.convertBtn = document.getElementById('convertBtn');
        this.convertText = document.getElementById('convertText');
        this.loadingSpinner = document.getElementById('loadingSpinner');
        this.progressSection = document.getElementById('progressSection');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.resultSection = document.getElementById('resultSection');
        this.downloadPdfBtn = document.getElementById('downloadPdfBtn');
        this.downloadHtmlBtn = document.getElementById('downloadHtmlBtn');
    }

    attachEventListeners() {
        // Eventos de drag and drop
        this.uploadArea.addEventListener('click', () => this.fileInput.click());
        this.uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        this.uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.uploadArea.addEventListener('drop', this.handleDrop.bind(this));

        // Evento de selección de archivo
        this.fileInput.addEventListener('change', this.handleFileSelect.bind(this));

        // Evento de conversión
        this.convertBtn.addEventListener('click', this.convertEPUBtoPDF.bind(this));

        // Evento de descarga
        this.downloadBtn.addEventListener('click', this.downloadPDF.bind(this));
    }

    handleDragOver(e) {
        e.preventDefault();
        this.uploadArea.classList.add('drag-over');
    }

    handleDragLeave(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('drag-over');
    }

    handleDrop(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type === 'application/epub+zip') {
            this.processFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file && file.type === 'application/epub+zip') {
            this.processFile(file);
        }
    }

    processFile(file) {
        this.selectedFile = file;
        this.fileName.textContent = file.name;
        this.fileSize.textContent = `Tamaño: ${(file.size / 1024 / 1024).toFixed(2)} MB`;
        this.fileInfo.style.display = 'block';
        this.resultSection.style.display = 'none';
    }

    async convertEPUBtoPDF() {
        if (!this.selectedFile) return;

        this.showProgress();
        this.setProgress(10, 'Leyendo archivo EPUB...');

        try {
            const zip = new JSZip();
            const contents = await zip.loadAsync(this.selectedFile);
            
            this.setProgress(30, 'Extrayendo contenido...');

            // Buscar el archivo OPF (contiene la metadata y orden de archivos)
            let opfFile = null;
            let opfPath = '';
            
            await Promise.all(Object.keys(contents.files).map(async (filename) => {
                if (filename.endsWith('.opf')) {
                    opfFile = await contents.files[filename].async('text');
                    opfPath = filename.substring(0, filename.lastIndexOf('/') + 1);
                }
            }));

            this.setProgress(50, 'Procesando estructura del libro...');

            // Crear el PDF
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF();
            
            // Configuración inicial del PDF
            pdf.setFontSize(16);
            pdf.text('Convertido desde EPUB', 20, 30);
            pdf.setFontSize(12);
            
            let yPosition = 50;
            const pageHeight = pdf.internal.pageSize.height;
            const margin = 20;
            const lineHeight = 7;

            this.setProgress(70, 'Extrayendo texto del contenido...');

            // Buscar archivos HTML/XHTML
            const textContent = [];
            await Promise.all(Object.keys(contents.files).map(async (filename) => {
                if ((filename.endsWith('.html') || filename.endsWith('.xhtml')) && 
                    !filename.includes('nav') && !filename.includes('toc')) {
                    const content = await contents.files[filename].async('text');
                    const textOnly = this.extractTextFromHTML(content);
                    if (textOnly.trim()) {
                        textContent.push(textOnly);
                    }
                }
            }));

            this.setProgress(85, 'Generando PDF...');

            // Agregar contenido al PDF
            const allText = textContent.join('\n\n');
            const lines = pdf.splitTextToSize(allText, pdf.internal.pageSize.width - 2 * margin);
            
            for (let i = 0; i < lines.length; i++) {
                if (yPosition > pageHeight - margin) {
                    pdf.addPage();
                    yPosition = margin;
                }
                pdf.text(lines[i], margin, yPosition);
                yPosition += lineHeight;
            }

            this.setProgress(95, 'Finalizando PDF...');

            // Guardar el PDF
            this.pdfData = pdf.output('blob');
            
            this.setProgress(100, '¡Conversión completada!');
            
            setTimeout(() => {
                this.showResult();
            }, 500);

        } catch (error) {
            console.error('Error durante la conversión:', error);
            alert('Error al convertir el archivo. Asegúrate de que sea un EPUB válido.');
            this.hideProgress();
        }
    }

    extractTextFromHTML(htmlContent) {
        // Crear un elemento temporal para extraer texto
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        
        // Remover scripts y estilos
        const scripts = tempDiv.querySelectorAll('script, style');
        scripts.forEach(el => el.remove());
        
        // Obtener solo el texto
        let text = tempDiv.textContent || tempDiv.innerText || '';
        
        // Limpiar espacios en blanco excesivos
        text = text.replace(/\s+/g, ' ').trim();
        
        return text;
    }

    showProgress() {
        this.convertBtn.disabled = true;
        this.convertText.style.display = 'none';
        this.loadingSpinner.style.display = 'block';
        this.progressSection.style.display = 'block';
    }

    setProgress(percent, message) {
        this.progressFill.style.width = percent + '%';
        this.progressText.textContent = message;
    }

    hideProgress() {
        this.convertBtn.disabled = false;
        this.convertText.style.display = 'block';
        this.loadingSpinner.style.display = 'none';
        this.progressSection.style.display = 'none';
    }

    showResult() {
        this.hideProgress();
        this.resultSection.style.display = 'block';
    }

    downloadPDF() {
        if (!this.pdfData) return;

        const fileName = this.selectedFile.name.replace('.epub', '.pdf');
        const url = URL.createObjectURL(this.pdfData);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    new EPUBtoPDFConverter();
});
