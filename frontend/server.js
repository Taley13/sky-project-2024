const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 4000;

// CORS для работы с API админки
app.use(cors({
    origin: ['http://localhost:7000', 'http://localhost:4000'],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Статические файлы
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/data', express.static(path.join(__dirname, 'data')));
app.use('/locales', express.static(path.join(__dirname, 'locales')));

// HTML страницы
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/services.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'services.html'));
});

app.get('/contacts.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'contacts.html'));
});

app.listen(PORT, () => {
    console.log('\n========================================');
    console.log('  Sky Frontend - Configurator');
    console.log(`  http://localhost:${PORT}`);
    console.log('  API Backend: http://localhost:7000');
    console.log('========================================\n');
});
