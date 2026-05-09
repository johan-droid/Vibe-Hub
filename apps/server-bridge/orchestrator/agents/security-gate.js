export class SecurityGate {
  analyze(vulnerabilityReport) {
    if (vulnerabilityReport && vulnerabilityReport.trim() !== '') {
      return {
        status: "REJECTED",
        vulnerability_report: vulnerabilityReport,
        severity: "CRITICAL"
      };
    }
    return { status: "PASSED" };
  }
}
