variable "aws_region" {
  type        = string
  description = "AWS region for the Vibe Hub environment."
  default     = "us-east-1"
}

variable "environment" {
  type        = string
  description = "Environment name, e.g. dev, staging, prod."
  default     = "dev"
}

variable "cluster_version" {
  type        = string
  description = "EKS Kubernetes version."
  default     = "1.31"
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the VPC."
  default     = "10.60.0.0/16"
}

variable "database_name" {
  type        = string
  description = "PostgreSQL database name."
  default     = "vibehub"
}

variable "database_username" {
  type        = string
  description = "PostgreSQL admin username. Store the password in Secrets Manager or an external vault."
  default     = "selina"
}

variable "allowed_cidr_blocks" {
  type        = list(string)
  description = "CIDR blocks allowed to reach private service endpoints during bootstrap."
  default     = []
}

variable "threat_intel_cidrs" {
  type        = list(string)
  description = "Known malicious IPv4 CIDRs to block at AWS WAF before requests reach the API."
  default     = []
}

variable "shield_protected_resource_arns" {
  type        = list(string)
  description = "Optional ALB, NLB, EIP, or CloudFront ARNs to enroll in AWS Shield Advanced."
  default     = []
}
