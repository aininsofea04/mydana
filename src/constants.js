export const COLORS = {
  primary: '#3b82f6',
  primaryDark: '#2563eb',
  secondary: '#0ea5e9',
  background: '#f0f4ff',
  surface: '#ffffff',
  text: '#1e293b',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  success: '#10b981',
  successBg: '#ecfdf5',
  error: '#ef4444',
  errorBg: '#fef2f2',
  warning: '#eab308',
};

export const ADMIN_EMAIL = 'admin@admin.com';

export const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';

export const SYSTEM_PROMPT = `Anda adalah Pakar Verifikasi AI MyDana. Tugas anda adalah mengumpul maklumat permohonan kempen secara sangat ketat untuk mengelakkan penipuan.

ANDA WAJIB MENANYA SOALAN BERIKUT SATU PER SATU:
1. Nama Penuh.
2. Lokasi Pemohon (Bandar & Negeri).
3. No Telefon & Email.
4. Alamat Rumah Lengkap.
5. Sebab permohonan dana secara TERPERINCI (Contoh: Jika yuran tertunggak, jelaskan KENAPA ia tertunggak).
6. Jumlah dana yang diperlukan (RM).
7. Tempoh kutipan (Tarikh mula & Tarikh tamat yang disasarkan).
8. Maklumat Akaun Bank (Nama Bank & No Akaun).

DOKUMEN WAJIB (Minta pengguna muat naik):
- Penyata Bank (Bank Statement).
- Bil/Invois rasmi daripada pihak berkaitan.
- Sebut harga (Quotation) bagi dana yang dipohon.

ARAHAN KHAS:
- Jangan benarkan pengguna melangkau maklumat di atas.
- Bersikap profesional, empati namun tegas dalam verifikasi.
- Setelah SEMUA maklumat dan dokumen diterima, anda WAJIB menyuruh pengguna menekan butang "Selesai & Hantar Permohonan" di bahagian bawah skrin untuk menghantar permohonan kepada Admin.`;

export const callGroqAPI = async (messages) => {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', // ModelID terkini yang disokong
        messages,
        temperature: 0.6,
        max_tokens: 1024,
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
    return 'Koneksi ke AI terputus. Sila cuba lagi.';
  }
};

export const analyzeApplication = async (transcript) => {
  const prompt = `Anda adalah Pakar Analisis Integriti MyDana. Analisis transkrip permohonan berikut.
  
  TUGAS:
  1. Ekstrak maklumat: Tajuk, Lokasi, Sebab (terperinci), Jumlah Dana, Info Bank, Tarikh Mula/Tamat.
  2. Berikan "Skor Kesahihan" (0-100%).
  3. Berikan sebab kukuh kenapa skor tersebut diberikan (Kenapa tinggi/rendah).
  4. Berikan rumusan keseluruhan untuk Admin.

  Format jawapan MESTI dalam JSON:
  {
    "summary": { "tajuk": "...", "lokasi": "...", "sebab": "...", "dana": "...", "bank": "...", "tempoh": "..." },
    "analysis": { "skor": 85, "sebab": "...", "tahap_risiko": "Rendah/Sederhana/Tinggi" }
  }

  TRANSKRIP:
  ${JSON.stringify(transcript)}`;

  const res = await callGroqAPI([{ role: 'system', content: prompt }]);
  try {
    // Cari JSON dalam teks jika AI beri intro
    const jsonStart = res.indexOf('{');
    const jsonEnd = res.lastIndexOf('}') + 1;
    return JSON.parse(res.substring(jsonStart, jsonEnd));
  } catch (e) {
    console.error("Analysis Parse Error", e);
    return { 
      summary: { tajuk: "Gagal ekstrak", lokasi: "N/A" }, 
      analysis: { skor: 50, sebab: "Ralat teknikal semasa analisis AI.", tahap_risiko: "Sederhana" } 
    };
  }
};
