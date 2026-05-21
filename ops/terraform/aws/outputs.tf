output "cluster_name" {
  value       = module.eks.cluster_name
  description = "EKS cluster name."
}

output "server_bridge_repository_url" {
  value       = aws_ecr_repository.server_bridge.repository_url
  description = "Immutable ECR repository for server-bridge images."
}

output "user_interface_repository_url" {
  value       = aws_ecr_repository.user_interface.repository_url
  description = "Immutable ECR repository for user-interface images."
}

output "database_endpoint" {
  value       = aws_db_instance.postgres.address
  description = "PostgreSQL endpoint."
}

output "redis_primary_endpoint" {
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  description = "Redis primary endpoint for queues and cache."
}

output "api_waf_web_acl_arn" {
  value       = aws_wafv2_web_acl.api_edge.arn
  description = "Regional AWS WAF Web ACL ARN to associate with the public API load balancer."
}
