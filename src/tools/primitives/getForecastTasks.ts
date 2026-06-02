import { executeOmniFocusScript } from '../../utils/scriptExecution.js';
import { formatTaskLine, formatDateOnly } from '../../utils/taskFormatting.js';

export interface GetForecastTasksOptions {
  days?: number;
  hideCompleted?: boolean;
  includeDeferredOnly?: boolean;
}

export async function getForecastTasks(options: GetForecastTasksOptions = {}): Promise<string> {
  const { days = 7, hideCompleted = true, includeDeferredOnly = false } = options;
  
  try {
    // Execute the forecast tasks script
    const result = await executeOmniFocusScript('@forecastTasks.js', { 
      days: days,
      hideCompleted: hideCompleted,
      includeDeferredOnly: includeDeferredOnly
    });
    
    if (typeof result === 'string') {
      return result;
    }
    
    // If result is an object, format it
    if (result && typeof result === 'object') {
      const data = result as any;
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Format the forecast tasks
      let output = `# Forecast — next ${days} ${days === 1 ? 'day' : 'days'}\n\n`;

      if (data.tasksByDate && typeof data.tasksByDate === 'object') {
        const dates = Object.keys(data.tasksByDate).sort();

        if (dates.length === 0) {
          output += "No tasks in the forecast period.\n";
        } else {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          dates.forEach(dateStr => {
            const tasks = data.tasksByDate[dateStr];
            if (!tasks || tasks.length === 0) return;

            const taskDate = new Date(dateStr);
            const isToday = taskDate.getTime() === today.getTime();
            const isTomorrow = taskDate.getTime() === today.getTime() + 24 * 60 * 60 * 1000;
            const isOverdue = taskDate < today;

            let label: string;
            if (isOverdue) label = 'Overdue';
            else if (isToday) label = 'Today';
            else if (isTomorrow) label = 'Tomorrow';
            else label = taskDate.toLocaleDateString('en-US', { weekday: 'long' });

            output += `## ${label} — ${formatDateOnly(dateStr)}\n\n`;

            tasks.forEach((task: any) => {
              output += formatTaskLine(task, { includeProject: true });
            });

            output += '\n';
          });

          const totalTasks = dates.reduce((sum, date) => sum + data.tasksByDate[date].length, 0);
          output += `Total: ${totalTasks} task${totalTasks === 1 ? '' : 's'} in forecast\n`;
        }
      } else {
        output += "No forecast data available\n";
      }
      
      return output;
    }
    
    return "Unexpected result format from OmniFocus";
    
  } catch (error) {
    console.error("Error in getForecastTasks:", error);
    throw new Error(`Failed to get forecast tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}