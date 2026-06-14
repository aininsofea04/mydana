import { GROQ_API_KEY as ENV_KEY } from './constants'; // We can move the key definition here entirely

export const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || ENV_KEY || '';
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as FileSystem from 'expo-file-system/legacy';


export const getSystemPrompt = (formData) => {
  const kategori = formData?.kategori || '[Kategori]';
  const jumlah = formData?.jumlah || '0';

  let prompt = `Anda adalah Pakar Verifikasi & Penasihat AI MyDana. 

PANDUAN BAHASA & INTERAKSI (SANGAT PENTING):
- Gunakan bahasa yang SANGAT RINGKAS, MUDAH, dan AYAT YANG PENDEK.
- Pemohon mungkin warga emas, jadi jangan tulis teks panjang-panjang atau berbelit-belit.
- Hadkan jawapan anda kepada 1 atau 2 perenggan pendek sahaja. Terus kepada poin utama.
- Jangan rumitkan proses. Jika sebab munasabah dan dokumen sepadan, segera selesai dan luluskan semakan AI.

TUGAS ANDA:
Bukan lagi untuk meminta maklumat asas, tetapi untuk MENYEMAK, MENGESAHKAN, dan MEMURNIKAN permohonan yang telah diisi oleh pemohon dalam borang bagi memastikan ia telus, berkualiti tinggi, dan bebas daripada unsur penipuan sebelum dihantar kepada Admin.

ARAHAN KERJA CHATBOT (LAKUKAN SECARA BERPERINGKAT):

1. SALUTASI & PENGESAHAN:
   Sapa pemohon dengan mesra dan ringkas. Nyatakan anda sedang menyemak permohonan mereka untuk kategori ${kategori}. 

2. VERIFIKASI DOKUMEN & JUMLAH (Kritikal):
   - Jika ada hasil imbasan Gemini (OCR) pada bil/invois, sahkan sama ada jumlah RM${jumlah} yang dipohon sepadan dengan dokumen. 
   - Jika ada isu dokumen, minta penjelasan dengan ayat yang mudah.

3. PEMURNIAN "SEBAB PERMOHONAN":
   - Baca "Sebab Permohonan" yang diisi. Jika terlalu ringkas (kurang daripada 30 patah perkataan), minta mereka tambah sedikit huraian ringkas (contoh: Kenapa tunggakan berlaku?) secara empati. Jangan paksa cerita yang terlalu panjang.
   - Bantu mereka strukturkan ayat pendek agar rayuan jelas untuk penderma.

4. NADA & SIKAP:
   - Sentiasa sopan, penuh empati, dan ringkas.
   - Jangan tanya semula data peribadi (No Tel, Emel, Alamat, Bank) kerana sudah ada dalam borang.

5. KELULUSAN AKHIR:
   Apabila sebab munasabah dan dokumen sepadan, beritahu pemohon semakan awal selesai.
   ARAHKAN mereka dengan jelas untuk menekan butang "Hantar Permohonan" di bawah skrin.`;

  return prompt;
};

// --- CORE API FUNCTION ---
export const callGroqAPI = async (messages) => {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages,
        temperature: 0.6,
        max_tokens: 2048,
        ...(messages.some(m => m.content && m.content.includes('Format jawapan MESTI dalam JSON'))
          ? { response_format: { type: "json_object" } } : {})
      }),
    });

    const data = await response.json();
    if (data.error) {
      console.error("GROQ API Error:", data.error);
      return 'Harap maaf, sistem sedang sibuk (API Error).';
    }

    return data.choices?.[0]?.message?.content || 'Harap maaf, sistem tergendala.';
  } catch (e) {
    console.error("Fetch Error:", e);
    return 'Talian AI terputus. Sila cuba lagi.';
  }
};

// --- AI FEATURES ---

/**
 * Menganalisis keseluruhan permohonan apabila pengguna menekan butang hantar.
 * Menjana skor, rumusan dan komen.
 */
export const analyzeApplication = async (transcript) => {
  const prompt = `Bertindak sebagai Pegawai Verifikasi Dana. Analisis transkrip permohonan di bawah berdasarkan kriteria berikut:
  1. Cross-Checking: Keselarasan fakta dengan bil/dokumen sokongan (padankan teks permohonan dengan entiti seperti Hospital/NGO untuk pastikan ia benar wujud).
  2. Entity Extraction & Logik Kronologi Kes: Ekstrak nama, tarikh, dan jumlah secara automatik, serta nilaikan logik kronologi kes tersebut.
  3. Tone Analysis: Pengesanan bahasa manipulatif (kenalpasti jika nada penulisan bersifat mendesak tanpa asas atau mengamalkan taktik "Panic Pressure").

  TUGAS:
  1. Ekstrak rumusan maklumat permohonan (Tajuk, Kategori, Lokasi, Sebab, Dana, Bank, Tempoh).
  2. Berikan skor keaslian (Authenticity Score) dari 1-100 (Sila letak pada "skor").
  3. Jika skor bawah 50, tandakan status sebagai 'Perlu Siasatan Manual'. Jika tidak, tandakan sebagai 'Disyorkan untuk Kelulusan'.
  4. Berikan hasil penilaian bagi setiap kriteria analisis.

  Format jawapan MESTI dalam JSON:
  {
    "summary": { "tajuk": "...", "kategori": "...", "lokasi": "...", "sebab": "...", "dana": "...", "bank": "...", "tempoh": "..." },
    "analysis": { 
      "skor": 85, 
      "status": "Disyorkan untuk Kelulusan",
      "crossChecking": "Rumusan semakan fakta...",
      "entityExtraction": "Ekstrak tarikh/jumlah dan logik...",
      "toneAnalysis": "Analisis nada mendesak/panik..."
    }
  }

  TRANSKRIP PERMOHONAN:
  ${JSON.stringify(transcript)}`;

  const res = await callGroqAPI([{ role: 'system', content: prompt }]);
  try {
    const jsonStart = res.indexOf('{');
    const jsonEnd = res.lastIndexOf('}') + 1;
    return JSON.parse(res.substring(jsonStart, jsonEnd));
  } catch (e) {
    console.error("Analysis Parse Error", e);
    return {
      summary: { tajuk: "Gagal ekstrak", lokasi: "N/A" },
      analysis: { skor: 50, status: "Perlu Siasatan Manual", crossChecking: "Gagal memproses", entityExtraction: "Gagal memproses", toneAnalysis: "Ralat teknikal." }
    };
  }
};


export const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export const analyzeDocument = async (imageUri, mimeType = "image/jpeg") => {
  try {
    if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('SILA_MASUKKAN')) {
      throw new Error("Sila masukkan API Key Gemini yang sah dalam fail .env.local (EXPO_PUBLIC_GEMINI_API_KEY).");
    }
    // 1. Tukar fail ke format Base64
    const base64Data = await FileSystem.readAsStringAsync(imageUri, {
      encoding: 'base64',
    });

    // 2. Inisialisasi Model (Flash adalah yang terpantas & percuma)
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    // 3. Set arahan spesifik (Prompt Engineering)
    const prompt = `Anda adalah Pegawai Verifikasi Dokumen untuk sistem MyDana.Tugas anda adalah menganalisis imej dokumen yang dimuat naik (bil, quotation, surat rujukan, atau resit).
      
      Sila ekstrak maklumat berikut dalam format JSON:
      {
        "jenis_dokumen": "Bil Hospital / Quotation / Surat Rasmi / Lain-lain",
        "institusi": "Nama hospital atau syarikat",
        "tarikh": "Tarikh dokumen dikeluarkan",
        "jumlah_rm": "Jumlah nilai kewangan jika ada (nombor sahaja)",
        "ringkasan": "Rumusan pendek tujuan dokumen",
        "status_verifikasi": "Sah / Perlu Semakan Manual",
        "sebab_status": "Alasan ringkas jika status perlu semakan"
      }

      Jika imej bukan dokumen rasmi, sila balas dengan JSON yang menyatakan dokumen tidak rasmi.
      Berikan respon dalam format JSON yang bersih tanpa markdown.
    `;

    const imageParts = [
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType,
        },
      },
    ];

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();

    let cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const jsonStart = cleanText.indexOf('{');
    const jsonEnd = cleanText.lastIndexOf('}') + 1;
    if (jsonStart !== -1 && jsonEnd !== -1) {
      cleanText = cleanText.substring(jsonStart, jsonEnd);
    }
    return JSON.parse(cleanText);

  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};