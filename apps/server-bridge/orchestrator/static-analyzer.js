import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export async function runPreFlight(filePaths) {
  if (!filePaths || filePaths.length === 0) {
    return { errors: false };
  }

  const filesStr = filePaths.join(' ');
  try {
    const { stdout, stderr } = await execAsync(`npx eslint --no-eslintrc --plugin react --rule 'no-undef: error' ${filesStr}`);
    return { errors: false, output: stdout };
  } catch (error) {
    // ESLint returns non-zero exit code if there are errors
    return { errors: true, summary: error.stdout || error.message };
  }
}
