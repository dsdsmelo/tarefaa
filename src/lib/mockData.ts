import { Person, Project, Phase, Cell, Device, Task } from './types';

export const mockPeople: Person[] = [
  { id: '1', name: 'Daniel Melo', email: 'daniel@company.com', type: 'internal', color: '#3B82F6', active: true },
  { id: '2', name: 'Bruno Brito', email: 'bruno@company.com', type: 'internal', color: '#10B981', active: true },
  { id: '3', name: 'William', email: 'william@company.com', type: 'internal', color: '#8B5CF6', active: true },
  { id: '4', name: 'Leandro Nitta', email: 'leandro@company.com', type: 'internal', color: '#F59E0B', active: true },
  { id: '5', name: 'Routz', email: 'routz@partner.com', type: 'partner', color: '#EF4444', active: true },
  { id: '6', name: 'BW', email: 'bw@partner.com', type: 'partner', color: '#EC4899', active: true },
];

export const mockCells: Cell[] = [
  { id: '1', name: 'Pessoa Física / Serviços Corporativos', description: 'Área de serviços corporativos', active: true },
  { id: '2', name: 'Serviços Críticos', description: 'Infraestrutura crítica', active: true },
  { id: '3', name: 'Core Mainframe', description: 'Sistemas mainframe', active: true },
];

export const mockDevices: Device[] = [
  { id: '1', name: 'Balanceadores', active: true },
  { id: '2', name: 'Firewall Cisco', active: true },
  { id: '3', name: 'Firewall Fortinet', active: true },
  { id: '4', name: 'Firewall Checkpoint', active: true },
  { id: '5', name: 'NetScout', active: true },
  { id: '6', name: 'Gigamon', active: true },
];

export const mockProjects: Project[] = [
  { id: '1', workspaceId: 'personal', name: 'Assessment Infraestrutura 2024', description: 'Levantamento completo da infraestrutura de rede', startDate: '2024-01-15', endDate: '2024-06-30', status: 'active' },
  { id: '2', workspaceId: 'personal', name: 'Migração Datacenter', description: 'Migração de equipamentos para novo datacenter', startDate: '2024-03-01', endDate: '2024-12-31', status: 'active' },
  { id: '3', workspaceId: 'personal', name: 'Modernização Firewall', description: 'Atualização de todos os firewalls da empresa', startDate: '2024-02-01', endDate: '2024-08-31', status: 'planning' },
];

export const mockPhases: Phase[] = [
  { id: '1', name: 'Coleta de Outputs', order: 1, color: '#3B82F6', projectId: '1' },
  { id: '2', name: 'Planilhamento', order: 2, color: '#10B981', projectId: '1' },
  { id: '3', name: 'Relatório de Assessment', order: 3, color: '#8B5CF6', projectId: '1' },
  { id: '4', name: 'Topologia', order: 4, color: '#F59E0B', projectId: '1' },
  { id: '5', name: 'Planejamento', order: 1, color: '#3B82F6', projectId: '2' },
  { id: '6', name: 'Execução', order: 2, color: '#10B981', projectId: '2' },
  { id: '7', name: 'Validação', order: 3, color: '#8B5CF6', projectId: '2' },
];

const today = new Date();
const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
const twoDaysAgo = new Date(today); twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
const nextWeek = new Date(today); nextWeek.setDate(nextWeek.getDate() + 7);

export const mockTasks: Task[] = [
  { 
    id: '1', 
    name: 'Coleta de outputs Firewall Cisco', 
    description: 'Coletar todos os outputs dos firewalls Cisco',
    projectId: '1', 
    phaseId: '1', 
    cellId: '2', 
    deviceId: '2', 
    responsibleId: '1',
    quantity: 45,
    collected: 38,
    startDate: '2024-01-20',
    endDate: '2024-02-15',
    sprintDate: '2024-02-10',
    status: 'in_progress',
    priority: 'high',
    observation: 'Aguardando acesso ao ambiente de produção',
    updatedAt: today.toISOString(),
  },
  { 
    id: '2', 
    name: 'Planilha de inventário Balanceadores', 
    projectId: '1', 
    phaseId: '2', 
    cellId: '1', 
    deviceId: '1', 
    responsibleId: '2',
    quantity: 20,
    collected: 20,
    startDate: '2024-02-01',
    endDate: '2024-02-28',
    status: 'completed',
    priority: 'medium',
    updatedAt: yesterday.toISOString(),
  },
  { 
    id: '3', 
    name: 'Coleta NetScout - Serviços Críticos', 
    projectId: '1', 
    phaseId: '1', 
    cellId: '2', 
    deviceId: '5', 
    responsibleId: '3',
    quantity: 30,
    collected: 15,
    startDate: '2024-01-25',
    endDate: twoDaysAgo.toISOString().split('T')[0],
    status: 'in_progress',
    priority: 'urgent',
    observation: 'Atrasado - problemas de acesso',
    updatedAt: today.toISOString(),
  },
  { 
    id: '4', 
    name: 'Relatório Firewall Fortinet', 
    projectId: '1', 
    phaseId: '3', 
    cellId: '3', 
    deviceId: '3', 
    responsibleId: '4',
    quantity: 10,
    collected: 0,
    startDate: '2024-03-01',
    endDate: '2024-03-31',
    status: 'pending',
    priority: 'medium',
    updatedAt: twoDaysAgo.toISOString(),
  },
  { 
    id: '5', 
    name: 'Topologia Gigamon', 
    projectId: '1', 
    phaseId: '4', 
    cellId: '2', 
    deviceId: '6', 
    responsibleId: '5',
    quantity: 5,
    collected: 2,
    startDate: '2024-02-15',
    endDate: '2024-03-15',
    status: 'in_progress',
    priority: 'low',
    updatedAt: yesterday.toISOString(),
  },
  { 
    id: '6', 
    name: 'Planejamento migração servidores', 
    projectId: '2', 
    phaseId: '5', 
    cellId: '1', 
    responsibleId: '1',
    startDate: '2024-03-01',
    endDate: '2024-03-31',
    status: 'completed',
    priority: 'high',
    updatedAt: twoDaysAgo.toISOString(),
  },
  { 
    id: '7', 
    name: 'Execução migração Fase 1', 
    projectId: '2', 
    phaseId: '6', 
    cellId: '2',
    responsibleId: '6',
    startDate: '2024-04-01',
    endDate: tomorrow.toISOString().split('T')[0],
    status: 'blocked',
    priority: 'urgent',
    observation: 'Bloqueado por falta de equipamento',
    updatedAt: today.toISOString(),
  },
  { 
    id: '8', 
    name: 'Validação ambiente de homologação', 
    projectId: '2', 
    phaseId: '7', 
    cellId: '3',
    startDate: '2024-05-01',
    endDate: nextWeek.toISOString().split('T')[0],
    status: 'pending',
    priority: 'medium',
    updatedAt: yesterday.toISOString(),
  },
  { 
    id: '9', 
    name: 'Documentação Firewall Checkpoint', 
    projectId: '1', 
    phaseId: '3', 
    deviceId: '4', 
    responsibleId: '2',
    quantity: 15,
    collected: 8,
    startDate: '2024-02-20',
    endDate: '2024-03-20',
    status: 'in_progress',
    priority: 'medium',
    updatedAt: today.toISOString(),
  },
  { 
    id: '10', 
    name: 'Análise de riscos migração', 
    projectId: '2', 
    phaseId: '5', 
    responsibleId: '4',
    startDate: '2024-03-15',
    endDate: '2024-04-15',
    status: 'in_progress',
    priority: 'high',
    updatedAt: yesterday.toISOString(),
  },
];

// Helper function to calculate task percentage
export const calculatePercentage = (task: Task): number => {
  // Completed tasks are 100%
  if (task.status === 'completed') return 100;

  // Cancelled tasks are 0%
  if (task.status === 'cancelled') return 0;

  // If task has quantity tracking, use that
  if (task.quantity && task.quantity > 0) {
    return Math.round(((task.collected || 0) / task.quantity) * 100);
  }

  // Default percentages based on status
  switch (task.status) {
    case 'in_progress':
      return 50;
    case 'blocked':
      return 25;
    case 'pending':
    default:
      return 0;
  }
};

// Helper function to check if task is overdue
export const isTaskOverdue = (task: Task): boolean => {
  if (!task.endDate) return false;
  if (task.status === 'completed' || task.status === 'cancelled') return false;
  return new Date(task.endDate) < new Date();
};

// Helper function to check if task is due soon (next 3 days)
export const isTaskDueSoon = (task: Task): boolean => {
  if (!task.endDate) return false;
  if (task.status === 'completed' || task.status === 'cancelled') return false;
  const endDate = new Date(task.endDate);
  const today = new Date();
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  return endDate >= today && endDate <= threeDaysFromNow;
};
