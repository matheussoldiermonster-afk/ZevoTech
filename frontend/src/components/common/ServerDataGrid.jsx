import { DataGrid } from '@mui/x-data-grid';
import { Paper } from '@mui/material';
import ErrorState from './ErrorState';

const localeText = {
  noRowsLabel: 'Nenhum registro encontrado',
  noResultsOverlayLabel: 'Nenhum resultado',
  footerRowSelected: (count) => `${count} selecionado(s)`,
  MuiTablePagination: {
    labelRowsPerPage: 'Linhas por página',
    labelDisplayedRows: ({ from, to, count }) => `${from}–${to} de ${count !== -1 ? count : `mais de ${to}`}`,
  },
};

/**
 * DataGrid com paginação/ordenação NO SERVIDOR.
 * Recebe o resultado de { data, total } e os modelos controlados.
 * Usado pelas listas a partir do Lote 3.
 */
export default function ServerDataGrid({
  query,
  columns,
  paginationModel,
  onPaginationModelChange,
  sortModel,
  onSortModelChange,
  height = 600,
  ...props
}) {
  if (query.isError && !query.data) {
    return (
      <Paper variant="outlined">
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ height, width: '100%' }}>
      <DataGrid
        rows={query.data?.data || []}
        rowCount={query.data?.total ?? 0}
        columns={columns}
        loading={query.isLoading || (query.isFetching && query.isPlaceholderData)}
        paginationMode="server"
        sortingMode="server"
        filterMode="server"
        paginationModel={paginationModel}
        onPaginationModelChange={onPaginationModelChange}
        sortModel={sortModel}
        onSortModelChange={onSortModelChange}
        pageSizeOptions={[10, 25, 50, 100]}
        disableRowSelectionOnClick
        disableColumnFilter
        localeText={localeText}
        slotProps={{ loadingOverlay: { variant: 'skeleton', noRowsVariant: 'skeleton' } }}
        sx={{ border: 0 }}
        {...props}
      />
    </Paper>
  );
}
