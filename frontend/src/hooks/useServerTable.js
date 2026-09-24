import { useMemo, useState } from 'react';
import useDebouncedValue from './useDebouncedValue';

/**
 * Estado de uma tabela paginada no servidor: página, ordenação e busca.
 * Retorna `params` prontos para a API ({ page, pageSize, sort, order, search }).
 */
export default function useServerTable({ pageSize = 25, sort, order = 'asc' } = {}) {
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize });
  const [sortModel, setSortModel] = useState(sort ? [{ field: sort, sort: order }] : []);
  const [search, setSearchRaw] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  const setSearch = (value) => {
    setSearchRaw(value);
    setPaginationModel((m) => ({ ...m, page: 0 }));
  };

  const resetPage = () => setPaginationModel((m) => ({ ...m, page: 0 }));

  const params = useMemo(
    () => ({
      page: paginationModel.page + 1,
      pageSize: paginationModel.pageSize,
      sort: sortModel[0]?.field,
      order: sortModel[0]?.sort,
      search: debouncedSearch || undefined,
    }),
    [paginationModel, sortModel, debouncedSearch]
  );

  return {
    params,
    search,
    setSearch,
    resetPage,
    gridProps: {
      paginationModel,
      onPaginationModelChange: setPaginationModel,
      sortModel,
      onSortModelChange: (m) => {
        setSortModel(m);
        resetPage();
      },
    },
  };
}
