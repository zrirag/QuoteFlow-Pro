import React, { useState, useEffect } from 'react';
import { TopNavigation } from '../components/layout/TopNavigation';
import { useStore } from '../store/useStore';
import { CorpTable } from '../components/ui/CorpTable';
import { CorpButton } from '../components/ui/CorpButton';
import { Badge } from '../components/ui/Badge';
import { Plus, Search, Shield, UserX, UserCheck } from 'lucide-react';
import type { Role } from '../types';

export const AdminPage: React.FC = () => {
  const { users, currentUser, fetchUsers } = useStore();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  if (currentUser?.role !== 'Admin') {
    return (
      <div className="min-h-screen bg-corp-bg flex flex-col font-sans">
        <TopNavigation />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-serif text-corp-text">Access Denied</h1>
            <p className="text-gray-500 mt-2">You do not have permission to view this page.</p>
          </div>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadge = (role: Role) => {
    switch(role) {
      case 'Admin': return <Badge variant="error">Admin</Badge>;
      case 'Manager': return <Badge variant="success">Manager</Badge>;
      case 'Employee': return <Badge variant="neutral">Employee</Badge>;
      default: return <Badge variant="neutral">{role}</Badge>;
    }
  };

  const tableData = filteredUsers.map(user => ({
    ...user,
    roleBadge: getRoleBadge(user.role),
    statusBadge: user.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Disabled</Badge>,
    actions: (
      <div className="flex justify-end gap-3" onClick={(e) => e.stopPropagation()}>
        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">Edit Role</button>
        {user.isActive ? (
          <button className="text-red-600 hover:text-red-800 text-sm font-medium flex items-center gap-1"><UserX className="w-4 h-4"/> Disable</button>
        ) : (
          <button className="text-green-600 hover:text-green-800 text-sm font-medium flex items-center gap-1"><UserCheck className="w-4 h-4"/> Enable</button>
        )}
      </div>
    )
  }));

  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    { key: 'roleBadge', header: 'Role' },
    { key: 'statusBadge', header: 'Status' },
    { key: 'actions', header: '', align: 'right' as const },
  ];

  return (
    <div className="min-h-screen bg-corp-bg flex flex-col font-sans">
      <TopNavigation />
      
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-serif text-corp-text">User Management</h1>
            <p className="text-corp-text-sec mt-1">Manage employees, managers, and system roles.</p>
          </div>
          <CorpButton>
            <Plus className="w-4 h-4 mr-2 inline" />
            Add User
          </CorpButton>
        </div>

        <div className="bg-white border border-corp-border p-4 mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search by name or email..." 
              className="w-full pl-10 pr-4 py-2 border border-corp-border focus:outline-none focus:border-corp-text transition-colors"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="text-sm text-gray-500">
            Total Users: {users.length}
          </div>
        </div>

        <CorpTable columns={columns} data={tableData} />

      </main>
    </div>
  );
};
