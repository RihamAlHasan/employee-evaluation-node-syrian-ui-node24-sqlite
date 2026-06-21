const UserRole = Object.freeze({
  Admin: 'Admin',
  CentralEvaluationManager: 'CentralEvaluationManager',
  EntityEvaluationManager: 'EntityEvaluationManager',
  DepartmentManager: 'DepartmentManager',
  DirectorGeneral: 'DirectorGeneral',
  Employee: 'Employee'
});

const TemplateType = Object.freeze({
  ManagerToEmployee: 'ManagerToEmployee',
  EmployeeToManager: 'EmployeeToManager',
  ManagerToManager: 'ManagerToManager',
  EmployeeToEmployee: 'EmployeeToEmployee',
  EmployeeSelf: 'EmployeeSelf',
  ManagerSelf: 'ManagerSelf',
  ProbationEmployeeSelf: 'ProbationEmployeeSelf',
  ManagerToProbationEmployee: 'ManagerToProbationEmployee',
  ProbationEmployeeToManager: 'ProbationEmployeeToManager',
  DirectorGeneralToManager: 'DirectorGeneralToManager'
});

const EvaluationStatus = Object.freeze({
  Pending: 'Pending',
  Processed: 'Processed',
  Approved: 'Approved',
  AppealInProgress: 'AppealInProgress',
  Reverted: 'Reverted'
});

const GrievanceStatus = Object.freeze({
  Pending: 'Pending',
  UnderReview: 'UnderReview',
  Accepted: 'Accepted',
  Rejected: 'Rejected',
  ResultAccepted: 'ResultAccepted'
});

module.exports = { UserRole, TemplateType, EvaluationStatus, GrievanceStatus };
