const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Мідлвери
app.use(cors());
app.use(express.json());

const PORT = 5000;
// Тепер підключаємося до хмари Atlas
const MONGO_URI = 'mongodb+srv://andy:Z26x10c1980@cluster0.bufmcs6.mongodb.net/SmartGreenhouseDB?retryWrites=true&w=majority';

// --- ПІДКЛЮЧЕННЯ ---
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Успішно підключено до хмарної MongoDB Atlas'))
    .catch((err) => console.error('❌ Помилка підключення:', err));

// --- СХЕМА (Зробив її гнучкою, щоб бачити дані напарника) ---
const telemetrySchema = new mongoose.Schema({
    device_id: String,
    greenhouse_id: String,
    timestamp: { type: Date, default: Date.now }
}, { strict: false }); // <--- ЦЕ ВАЖЛИВО: дозволяє бачити всі поля з бази

// Створюємо модель (явна назва колекції 'telemetry' в кінці)
const Telemetry = mongoose.model('Telemetry', telemetrySchema, 'telemetry');

// --- МАРШРУТИ ---

// 1. Отримати всі дані
app.get('/api/telemetry', async (req, res) => {
    try {
        const data = await Telemetry.find().sort({ timestamp: -1 });
        console.log(`Знайдено записів у базі: ${data.length}`); // Виведе в консоль кількість
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: "Помилка сервера", error });
    }
});

// 2. Отримати останній запис
app.get('/api/telemetry/latest', async (req, res) => {
    try {
        const latestData = await Telemetry.findOne().sort({ timestamp: -1 });
        if (!latestData) return res.status(404).json({ message: "Даних немає" });
        res.json(latestData);
    } catch (error) {
        res.status(500).json({ message: "Помилка", error });
    }
});

// 3. Зберегти нові дані
app.post('/api/telemetry', async (req, res) => {
    try {
        const newEntry = new Telemetry(req.body);
        await newEntry.save();
        res.status(201).json({ message: "Збережено!", data: newEntry });
    } catch (error) {
        res.status(400).json({ message: "Помилка запису", error });
    }
});

// Запуск
app.listen(PORT, () => {
    console.log(`🚀 Сервер працює: http://localhost:${PORT}`);
    console.log(`🔗 Маршрут для перевірки: http://localhost:${PORT}/api/telemetry`);
});