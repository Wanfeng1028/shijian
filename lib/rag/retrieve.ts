// 第 4 步 RAG 替换此处实现。
export async function retrieveContext(
  query: string,
  opts: { task?: string; grade?: string; textbook?: string }
): Promise<{
  context: string;
  sources: Array<{ book: string; unit: string; lesson: string; page: string }>;
}> {
  void query;
  void opts;
  return { context: '', sources: [] };
}
