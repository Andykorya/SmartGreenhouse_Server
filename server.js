const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Мідлвери
app.use(cors());
app.use(express.json());

const PORT = 5000;
// Підключення до хмари Atlas
const MONGO_URI = 'mongodb+srv://andy:Z26x10c1980@cluster0.bufmcs6.mongodb.net/SmartGreenhouseDB?retryWrites=true&w=majority';

// --- ПІДКЛЮЧЕННЯ ---
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Успішно підключено до хмарної MongoDB Atlas'))
    .catch((err) => console.error('❌ Помилка підключення:', err));

// --- СХЕМА ---
const telemetrySchema = new mongoose.Schema({
    device_id: String,
    greenhouse_id: String,
    timestamp: { type: Date, default: Date.now }
}, { strict: false }); 

const Telemetry = mongoose.model('Telemetry', telemetrySchema, 'telemetry');

// --- ЗМІННІ КЕРУВАННЯ ---
// Сховище для стану дверей (за замовчуванням авто-режим і закриті)
let doorControl = {
    mode: "auto",      // "auto" або "manual"
    command: "close"   // "open" або "close"
};

// --- МАРШРУТИ ---

// 1. Отримати всі дані
app.get('/api/telemetry', async (req, res) => {
    try {
        const data = await Telemetry.find().sort({ timestamp: -1 });
        console.log(`Знайдено записів у базі: ${data.length}`); 
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: "Помилка сервера", error });
    }
});

// 2. Отримати останній запис (для головної сторінки)
app.get('/api/telemetry/latest', async (req, res) => {
    try {
        const latestData = await Telemetry.findOne().sort({ timestamp: -1 });
        if (!latestData) return res.status(404).json({ message: "Даних немає" });
        res.json(latestData);
    } catch (error) {
        res.status(500).json({ message: "Помилка", error });
    }
});

// 3. Зберегти нові дані (від ESP32)
app.post('/api/telemetry', async (req, res) => {
    try {
        const newEntry = new Telemetry(req.body);
        await newEntry.save();
        res.status(201).json({ message: "Збережено!", data: newEntry });
    } catch (error) {
        res.status(400).json({ message: "Помилка запису", error });
    }
});

// 4. Маршрут для історії: середня за кожну хвилину за останню годину
app.get('/api/telemetry/history', async (req, res) => {
    try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        const data = await Telemetry.aggregate([
            { $match: { timestamp: { $gte: oneHourAgo } } },
            {
                $group: {
                    _id: {
                        year: { $year: "$timestamp" },
                        month: { $month: "$timestamp" },
                        day: { $dayOfMonth: "$timestamp" },
                        hour: { $hour: "$timestamp" },
                        minute: { $minute: "$timestamp" }
                    },
                    temperature: { $avg: "$temperature" },
                    humidity: { $avg: "$humidity" },
                    soil_moisture: { $avg: "$soil_moisture" },
                    light_lux: { $avg: "$light_lux" }
                }
            },
            {
                $project: {
                    _id: 0,
                    timestamp: {
                        $dateFromParts: {
                            year: "$_id.year", month: "$_id.month", day: "$_id.day",
                            hour: "$_id.hour", minute: "$_id.minute"
                        }
                    },
                    temperature: 1, humidity: 1, soil_moisture: 1, light_lux: 1
                }
            },
            { $sort: { timestamp: 1 } }
        ]);

        res.json(data);
    } catch (error) {
        res.status(500).json({ message: "Помилка сервера", error });
    }
});

// 5. Маршрут для команд (ESP32 запитує цей шлях, щоб знати що робити)
app.get('/api/command', (req, res) => {
    res.json(doorControl);
});

// 6. Маршрут для сайту (кнопки на сайті відправляють дані сюди)
app.post('/api/command', (req, res) => {
    const { mode, command } = req.body;
    
    if (mode) doorControl.mode = mode;
    if (command) doorControl.command = command;
    
    console.log(`📡 Нова команда від сайту: Режим [${doorControl.mode}], Двері [${doorControl.command}]`);
    res.json({ message: "Команду оновлено", current: doorControl });
});

// --- ЗАПУСК ---
app.listen(PORT, () => {
    console.log(`🚀 Сервер працює: http://localhost:${PORT}`);
    console.log(`🔗 Маршрут для перевірки: http://localhost:${PORT}/api/telemetry`);
});