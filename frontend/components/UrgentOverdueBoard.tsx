'use client';

import { TaskList } from '@/components/TaskList';

interface Task {
  id: string;
  title: string;
  detail?: string;
  priority: number;
  due_at?: string;
  status: string;
  project_id?: string;
  project_name?: string;
}

interface Project {
  id: string;
  name: string;
}

interface UrgentOverdueBoardProps {
  tasksPending: Task[];
  tasksOverdue: Task[];
  onTaskUpdate: () => void;
  projects?: Project[];
}

export function UrgentOverdueBoard({ tasksPending, tasksOverdue, onTaskUpdate, projects = [] }: UrgentOverdueBoardProps) {
  const urgentTasks = tasksPending.filter((task) => task.priority === 1);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <TaskList
        title="Urgentes"
        tasks={urgentTasks}
        onTaskUpdate={onTaskUpdate}
        projects={projects}
      />
      <TaskList
        title="Atrasadas"
        tasks={tasksOverdue}
        onTaskUpdate={onTaskUpdate}
        variant="overdue"
        projects={projects}
      />
    </div>
  );
}
