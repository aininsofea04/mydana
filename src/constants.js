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

export const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || process.env.GROQ_API_KEY || '';

export const SYSTEM_PROMPT = `Anda adalah Pembantu AI MyDana. Tugas anda adalah mengambil butiran untuk permohonan Kempen Kutipan Dana.
Proses:
1. Sapa pengguna dan minta Nama Penuh jika belum diberi.
2. Tanya tujuan bantuan dan jumlah wang yang diperlukan (RM).
3. Selepas mendapat butiran, minta pengguna lampirkan dokumen sokongan yang berkaitan di ruangan chat.
Tanya satu soalan pada satu masa. Bersikap empati dan profesional dalam Bahasa Melayu.`;

export const callGroqAPI = async (messages) => {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.6,
      max_tokens: 1024,
    }),
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Harap maaf, sistem tergendala.';
};
