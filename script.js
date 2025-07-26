class EPUBtoHTMLConverter {
    constructor() {
        this.selectedFile = null;
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
    }

    attachEventListeners() {
        // Verificar que todos los elementos existen antes de agregar listeners
        if (!this.uploadArea || !this.fileInput || !this.convertBtn) {
            console.error('Error: No se pudieron encontrar todos los elementos necesarios');
            return;
        }

        // Eventos de drag and drop
        this.uploadArea.addEventListener('click', () => this.fileInput.click());
        this.uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        this.uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.uploadArea.addEventListener('drop', this.handleDrop.bind(this));

        // Evento de selección de archivo
        this.fileInput.addEventListener('change', this.handleFileSelect.bind(this));

        // Evento de conversión
        this.convertBtn.addEventListener('click', this.convertEPUBtoHTML.bind(this));
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

    async convertEPUBtoHTML() {
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

            this.setProgress(85, 'Generando archivo HTML...');

            // Generar HTML
            const htmlContent = this.generateHTML(textContent, this.selectedFile.name);
            this.htmlData = new Blob([htmlContent], { type: 'text/html' });

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
        
        // Obtener el texto preservando cierta estructura
        let text = this.processElementForText(tempDiv);
        
        return text.trim();
    }

    processElementForText(element) {
        let result = '';
        
        for (let node of element.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                let text = node.textContent.trim();
                if (text) {
                    result += text + ' ';
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const tagName = node.tagName.toLowerCase();
                
                // Agregar saltos de línea para elementos de bloque
                if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br'].includes(tagName)) {
                    result += '\n' + this.processElementForText(node) + '\n';
                } else {
                    result += this.processElementForText(node);
                }
            }
        }
        
        return result;
    }

    generateHTML(textContent, originalFileName) {
        const title = originalFileName.replace('.epub', '');
        
        // Extraer información del libro
        const bookInfo = this.extractBookInfo(textContent, title);
        
        // Generar índice de capítulos
        const tableOfContents = this.generateTableOfContents(textContent);
        
        // Procesar cada capítulo para mejor estructura
        const processedChapters = textContent.map((chapterText, index) => {
            return this.formatChapterContent(chapterText, index);
        }).join('\n');
        
        return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${bookInfo.title}</title>
    <style>
        body {
            font-family: 'Georgia', 'Times New Roman', serif;
            line-height: 1.8;
            max-width: 900px;
            margin: 0 auto;
            padding: 40px 20px;
            background-color: #fafafa;
            color: #2c3e50;
        }
        
        /* Portada */
        .cover-page {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 80px 40px;
            margin: -40px -20px 60px -20px;
            text-align: center;
            border-radius: 0 0 20px 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        
        .cover-title {
            font-size: 3em;
            font-weight: bold;
            margin-bottom: 20px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            letter-spacing: 2px;
        }
        
        .cover-author {
            font-size: 1.5em;
            margin-bottom: 30px;
            opacity: 0.9;
            font-style: italic;
        }
        
        .cover-details {
            font-size: 1em;
            opacity: 0.8;
            border-top: 2px solid rgba(255,255,255,0.3);
            padding-top: 20px;
            margin-top: 30px;
        }
        
        /* Índice */
        .table-of-contents {
            background: white;
            padding: 40px;
            margin-bottom: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
            border-left: 6px solid #3498db;
        }
        
        .toc-title {
            color: #2c3e50;
            font-size: 2em;
            font-weight: bold;
            margin-bottom: 30px;
            text-align: center;
            border-bottom: 2px solid #ecf0f1;
            padding-bottom: 15px;
        }
        
        .toc-list {
            list-style: none;
            padding: 0;
        }
        
        .toc-item {
            margin-bottom: 12px;
            padding: 10px 15px;
            border-radius: 8px;
            transition: background-color 0.3s ease;
        }
        
        .toc-item:hover {
            background-color: #f8f9fa;
        }
        
        .toc-link {
            text-decoration: none;
            color: #34495e;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: 500;
        }
        
        .toc-link:hover {
            color: #3498db;
        }
        
        .toc-number {
            background: #3498db;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.9em;
            min-width: 25px;
            text-align: center;
        }
        
        /* Capítulos */
        .chapter {
            background: white;
            padding: 40px;
            margin-bottom: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
            border-left: 6px solid #3498db;
            scroll-margin-top: 20px;
        }
        
        .chapter-title {
            color: #2c3e50;
            font-size: 1.8em;
            font-weight: bold;
            margin-bottom: 25px;
            padding-bottom: 15px;
            border-bottom: 2px solid #ecf0f1;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .section-title {
            color: #34495e;
            font-size: 1.4em;
            font-weight: bold;
            margin: 30px 0 20px 0;
            text-transform: capitalize;
        }
        
        .content p {
            margin-bottom: 18px;
            text-align: justify;
            text-indent: 1.5em;
        }
        
        .content p:first-child {
            text-indent: 0;
        }
        
        .dropcap {
            float: left;
            font-family: Georgia, serif;
            font-size: 4em;
            line-height: 0.8;
            padding-right: 8px;
            padding-top: 4px;
            color: #3498db;
            font-weight: bold;
        }
        
        .footer {
            text-align: center;
            margin-top: 60px;
            padding-top: 30px;
            border-top: 2px solid #bdc3c7;
            color: #7f8c8d;
            font-style: italic;
        }
        
        /* Navegación */
        .nav-top {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #3498db;
            color: white;
            padding: 10px 15px;
            border-radius: 25px;
            text-decoration: none;
            font-size: 0.9em;
            box-shadow: 0 4px 15px rgba(52, 152, 219, 0.3);
            transition: all 0.3s ease;
            z-index: 1000;
        }
        
        .nav-top:hover {
            background: #2980b9;
            transform: translateY(-2px);
        }
        
        @media (max-width: 600px) {
            body {
                padding: 20px 10px;
            }
            .cover-page {
                padding: 40px 20px;
                margin: -20px -10px 40px -10px;
            }
            .cover-title {
                font-size: 2em;
            }
            .chapter {
                padding: 25px;
            }
            .nav-top {
                display: none;
            }
        }
    </style>
</head>
<body>
    <a href="#top" class="nav-top">↑ Inicio</a>
    
    <div id="top" class="cover-page">
        <h1 class="cover-title">${bookInfo.title}</h1>
        ${bookInfo.author ? `<div class="cover-author">por ${bookInfo.author}</div>` : ''}
        <div class="cover-details">
            <div>Convertido desde formato EPUB</div>
            <div>${new Date().toLocaleDateString()}</div>
        </div>
    </div>
    
    <div class="table-of-contents">
        <h2 class="toc-title">📚 Índice de Contenidos</h2>
        <ul class="toc-list">
            ${tableOfContents}
        </ul>
    </div>
    
    ${processedChapters}
    
    <div class="footer">
        <p>📖 Documento generado automáticamente desde EPUB</p>
        <p>Fecha de conversión: ${new Date().toLocaleDateString()}</p>
    </div>
</body>
</html>`;
    }

    extractBookInfo(textContent, defaultTitle) {
        // Intentar extraer información del libro
        let title = defaultTitle;
        let author = '';
        
        // Buscar en el primer capítulo información del libro
        if (textContent.length > 0) {
            const firstChapter = textContent[0];
            
            // Buscar autor en patrones comunes
            const authorPatterns = [
                /(?:por|author|autor)[\s:]+([^,\n]+)/i,
                /([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*),/,
                /^([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)\s*-/
            ];
            
            for (const pattern of authorPatterns) {
                const match = firstChapter.match(pattern);
                if (match && match[1]) {
                    author = match[1].trim();
                    break;
                }
            }
            
            // Buscar título mejorado
            const lines = firstChapter.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            if (lines.length > 0) {
                const firstLine = lines[0];
                if (firstLine.length < 100 && !firstLine.includes('PORTADA')) {
                    title = firstLine.replace(/^.*-\s*/, '').trim();
                }
            }
        }
        
        return { title, author };
    }

    generateTableOfContents(textContent) {
        let tocHtml = '';
        let chapterNumber = 1;
        
        textContent.forEach((chapterText, index) => {
            const lines = chapterText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            
            if (lines.length === 0) return;
            
            // Encontrar el título del capítulo
            let chapterTitle = '';
            for (let i = 0; i < Math.min(3, lines.length); i++) {
                const line = lines[i];
                if (this.isTitle(line, i, lines)) {
                    chapterTitle = this.formatTitle(line);
                    break;
                }
            }
            
            // Si no encontramos título, usar las primeras palabras
            if (!chapterTitle && lines.length > 0) {
                chapterTitle = lines[0].substring(0, 50);
                if (lines[0].length > 50) chapterTitle += '...';
            }
            
            if (chapterTitle && !chapterTitle.includes('PORTADA') && !chapterTitle.includes('CRÉDITOS')) {
                tocHtml += `
                    <li class="toc-item">
                        <a href="#chapter-${index}" class="toc-link">
                            <span>${chapterTitle}</span>
                            <span class="toc-number">${chapterNumber}</span>
                        </a>
                    </li>`;
                chapterNumber++;
            }
        });
        
        return tocHtml;
    }

    formatChapterContent(chapterText, chapterIndex) {
        // Dividir en líneas y procesar
        const lines = chapterText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        if (lines.length === 0) return '';
        
        // Saltar portadas y créditos
        if (chapterText.includes('PORTADA') || chapterText.includes('CRÉDITOS')) {
            return '';
        }
        
        let html = `<div id="chapter-${chapterIndex}" class="chapter">\n`;
        let contentHtml = '<div class="content">\n';
        let hasTitle = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Detectar títulos
            if (this.isTitle(line, i, lines)) {
                if (!hasTitle) {
                    html += `<h2 class="chapter-title">${this.formatTitle(line)}</h2>\n`;
                    hasTitle = true;
                } else {
                    contentHtml += `<h3 class="section-title">${this.formatTitle(line)}</h3>\n`;
                }
            } else if (this.isSubtitle(line)) {
                contentHtml += `<h3 class="section-title">${line}</h3>\n`;
            } else {
                // Es contenido normal
                if (line.length > 30) { // Solo párrafos con contenido sustancial
                    const formattedParagraph = this.formatParagraph(line, i === 0 && !hasTitle);
                    contentHtml += formattedParagraph + '\n';
                }
            }
        }
        
        contentHtml += '</div>\n';
        html += contentHtml + '</div>\n';
        
        return html;
    }

    isTitle(line, index, allLines) {
        // Detectar títulos por varios criterios
        const isAllCaps = line === line.toUpperCase() && line.includes(' ');
        const isShort = line.length < 80;
        const hasNumbers = /^\d+\./.test(line.trim());
        const isFirstLine = index === 0;
        const noEndPunctuation = !line.match(/[.!?]$/);
        
        return (isAllCaps && isShort) || 
               (hasNumbers && isShort) || 
               (isFirstLine && isShort && noEndPunctuation);
    }

    isSubtitle(line) {
        // Detectar subtítulos
        return line.length < 100 && 
               !line.match(/[.!?]$/) && 
               line.match(/^[A-ZÁÉÍÓÚÑ]/);
    }

    formatTitle(title) {
        // Limpiar y formatear títulos
        return title.replace(/^\d+\.\s*/, '').trim();
    }

    formatParagraph(text, isFirst = false) {
        // Agregar dropcap al primer párrafo si es apropiado
        if (isFirst && text.length > 50) {
            const firstChar = text.charAt(0);
            const restText = text.substring(1);
            return `<p><span class="dropcap">${firstChar}</span>${restText}</p>`;
        }
        return `<p>${text}</p>`;
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
        
        // Agregar event listener al botón de descarga ahora que está visible
        const downloadHtmlBtn = document.getElementById('downloadHtmlBtn');
        
        if (downloadHtmlBtn) {
            downloadHtmlBtn.addEventListener('click', this.downloadHTML.bind(this));
        }
    }

    downloadHTML() {
        if (!this.htmlData) return;

        const fileName = this.selectedFile.name.replace('.epub', '.html');
        const url = URL.createObjectURL(this.htmlData);
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
    new EPUBtoHTMLConverter();
});
