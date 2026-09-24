import api from '../services/api';

/**
 * Baixa um arquivo de um endpoint autenticado (o token vai no cabeçalho,
 * por isso não dá para usar um link <a href> direto).
 */
export async function downloadFile(url, params, filename) {
  const res = await api.get(url, { params, responseType: 'blob', timeout: 120000 });
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/**
 * Com responseType 'blob', a mensagem de erro do servidor chega como Blob.
 * Converte de volta para o formato normal antes de exibir.
 */
export async function normalizeBlobError(err) {
  const data = err?.response?.data;
  if (data instanceof Blob && data.type.includes('json')) {
    try {
      err.response.data = JSON.parse(await data.text());
    } catch {
      /* mantém o erro original */
    }
  }
  return err;
}
