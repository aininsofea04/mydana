import { GROQ_API_KEY as ENV_KEY } from './constants'; // We can move the key definition here entirely

export const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || ENV_KEY || '';
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as FileSystem from 'expo-file-system';


export const getSystemPrompt = (existingApp) => {
  let prompt = `Anda adalah Pakar Verifikasi AI MyDana. Tugas anda adalah mengumpul maklumat permohonan kempen secara sangat ketat untuk mengelakkan penipuan.

ANDA WAJIB MENANYA SOALAN BERIKUT SATU PER SATU:
1. Nama Penuh.
2. Lokasi Pemohon (Bandar & Negeri).
3. No Telefon & Email.
4. Alamat Rumah Lengkap.
5. Kategori Permohonan (cth: Rawatan Perubatan, Pendidikan, Bantuan Sara Hidup, Haiwan, Bencana Alam, etc).
6. Sebab permohonan dana secara TERPERINCI (Contoh: Jika yuran tertunggak, jelaskan KENAPA ia tertunggak).
7. Jumlah dana yang diperlukan (RM).
8. Tempoh kutipan (Tarikh mula & Tarikh tamat yang disasarkan).
9. Maklumat Akaun Bank (Nama Bank & No Akaun).

DOKUMEN WAJIB (Minta pengguna muat naik):
- Penyata Bank (Bank Statement).
- Bil/Invois rasmi daripada pihak berkaitan.
- Sebut harga (Quotation) bagi dana yang dipohon.

ARAHAN KHAS:
- Jangan benarkan pengguna melangkau maklumat di atas.
- Bersikap profesional, empati namun tegas dalam verifikasi.
- Setelah SEMUA maklumat dan dokumen diterima, anda WAJIB menyuruh pengguna menekan butang "Selesai & Hantar Permohonan" di bahagian bawah skrin untuk menghantar permohonan kepada Admin.`;

  if (existingApp && existingApp.summary) {
    prompt += `\n\nMAKLUMAT PEMOHON SEDIA ADA (Dari permohonan lepas):
Lokasi: ${existingApp.summary.lokasi || 'Tidak direkod'}
Bank: ${existingApp.summary.bank || 'Tidak direkod'}

ARAHAN TAMBAHAN UNTUK PEMOHON BERULANG:
- Pengguna ini telah membuat permohonan sebelum ini.
- Jangan tanya semula Nama, Lokasi, Telefon, Alamat, dan Maklumat Bank.
- Sebaliknya, nyatakan maklumat mereka yang sedia ada, dan minta mereka SAHKAN jika maklumat peribadi dan bank masih sama.
- Jika pengguna mengesahkan masih sama, TERUSKAN dengan bertanya maklumat KHUSUS untuk kempen baru: Kategori, Sebab Terperinci, Jumlah Dana, Tempoh Kutipan, dan Dokumen Wajib yang baru.`;
  }

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


// Inisialisasi dengan API Key anda
const genAI = new GoogleGenerativeAI("AIzaSyCtjsDBR22Ed-YUmFwidbrjw__FP9C9vfU");

export const analyzeDocument = async (imageUri, mimeType = "image/jpeg") => {
  try {
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

    // 4. Hantar ke Gemini
    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();

    // 5. Parse hasil ke JSON dengan selamat (buang markdown)
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