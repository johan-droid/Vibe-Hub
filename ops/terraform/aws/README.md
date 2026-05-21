# AWS Infrastructure

This Terraform stack is the cloud-native baseline for immutable Vibe Hub deployments.

It provisions:

- ECR repositories with immutable tags and scan-on-push for `server-bridge` and `user-interface`.
- A private-subnet EKS cluster for Kubernetes workloads.
- Encrypted PostgreSQL RDS for durable application state.
- Encrypted ElastiCache Redis for BullMQ queues, cache, and WebSocket coordination.
- Secrets Manager storage for generated database credentials.

Apply flow:

```bash
cd ops/terraform/aws
terraform init
terraform plan -var="environment=dev"
terraform apply -var="environment=dev"
```

Production notes:

- Use remote state with locking before sharing this stack.
- Feed application secrets from Vault, AWS Secrets Manager, or an external secret operator.
- Keep image tags immutable and deploy by digest or commit SHA.
- Install Istio or Linkerd before applying the canary manifests in `ops/kubernetes/canary`.
