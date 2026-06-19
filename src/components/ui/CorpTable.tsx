import React from 'react';

interface Column {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
}

interface CorpTableProps {
  columns: Column[];
  data: any[];
  onRowClick?: (row: any) => void;
}

export const CorpTable: React.FC<CorpTableProps> = ({ columns, data, onRowClick }) => {
  return (
    <div className="w-full overflow-x-auto border border-corp-border bg-white">
      <table className="w-full text-left text-sm text-corp-text">
        <thead className="bg-corp-bg-sec border-b border-corp-border text-xs uppercase tracking-wider text-corp-text-sec">
          <tr>
            {columns.map((col) => (
              <th 
                key={col.key} 
                className={`px-6 py-4 font-semibold ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-corp-border">
          {data.map((row, idx) => (
            <tr 
              key={idx} 
              onClick={() => onRowClick && onRowClick(row)}
              className={`hover:bg-[#FCFCFC] transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {columns.map((col) => (
                <td 
                  key={col.key} 
                  className={`px-6 py-4 whitespace-nowrap ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                >
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
