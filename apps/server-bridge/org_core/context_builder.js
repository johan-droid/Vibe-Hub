import fs from 'fs/promises';
import path from 'path';

class OrgContextBuilder {
  static async buildGlobalConstraints() {
    try {
      // In a real scenario, you'd populate these files. 
      // We wrap in try/catch to return defaults if files don't exist yet during setup.
      let ciConfig = "Use Local Docker Sandboxing only. No cloud deployment.";
      let lintRules = { "semi": ["error", "always"], "quotes": ["error", "single"] };

      try {
        ciConfig = await fs.readFile(path.join(__dirname, 'ci_cd_templates/standard.yml'), 'utf-8');
        const rawLintRules = await fs.readFile(path.join(__dirname, 'global_linting/rules.json'), 'utf-8');
        lintRules = JSON.parse(rawLintRules);
      } catch (e) {
        // Silent catch for initial setup
      }
      
      return {
        type: 'ORGANIZATION_BOUNDARY',
        enforced_rules: {
          ci_cd: ciConfig,
          linting: lintRules,
          deployment_target: 'local_docker_sandbox_only'
        }
      };
    } catch (error) {
      throw new Error(`CRITICAL: Org constraints missing. Execution halted. ${error.message}`);
    }
  }
}

export default OrgContextBuilder;
