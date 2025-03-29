# ECR Repository
resource "aws_ecr_repository" "main" {
  name                 = var.app_name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.common_tags
}

# App Runner VPC Connector
resource "aws_apprunner_vpc_connector" "main" {
  vpc_connector_name = "fuse-vpc-connector"
  subnets            = [aws_subnet.private_1.id, aws_subnet.private_2.id]
  security_groups    = [aws_security_group.app_runner.id]

  tags = local.common_tags
}

# IAM Role for App Runner Service
resource "aws_iam_role" "app_runner_service_role" {
  name = "${local.resource_prefix}-app-runner-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "build.apprunner.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "app_runner_service_role_attachment" {
  role       = aws_iam_role.app_runner_service_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

# App Runner Service
resource "aws_apprunner_service" "main" {
  service_name = local.resource_prefix

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.app_runner_service_role.arn
    }

    image_repository {
      image_configuration {
        port = "3000"
        runtime_environment_variables = {
          "NODE_ENV"         = var.environment
          "DB_HOST"          = aws_db_instance.main.address
          "DB_PORT"          = "5432"
          "DB_USERNAME"      = var.db_username
          "DB_PASSWORD"      = var.db_password
          "DB_DATABASE"      = "fuse"
          "REDIS_HOST"       = aws_elasticache_cluster.main.cache_nodes.0.address
          "REDIS_PORT"       = "6379"
          "FUSE_API_KEY"     = var.fuse_api_key
          "FUSE_API_BASE_URL" = "https://api.challenge.fusefinance.com"
          "SMTP_HOST"        = var.smtp_host
          "SMTP_PORT"        = var.smtp_port
          "SMTP_USER"        = var.smtp_user
          "SMTP_PASS"        = var.smtp_pass
          "EMAIL_FROM"       = var.email_from
          "EMAIL_RECIPIENTS" = var.email_recipients
        }
      }
      image_identifier      = "${aws_ecr_repository.main.repository_url}:latest"
      image_repository_type = "ECR"
    }
  }

  network_configuration {
    egress_configuration {
      egress_type       = "VPC"
      vpc_connector_arn = aws_apprunner_vpc_connector.main.arn
    }
    
    # Add ingress configuration to ensure full connectivity
    ingress_configuration {
      is_publicly_accessible = true
    }
  }

  health_check_configuration {
    path     = "/api/health"
    protocol = "HTTP"
  }

  instance_configuration {
    cpu    = "1 vCPU"
    memory = "2 GB"
  }

  tags = local.common_tags

  depends_on = [
    aws_db_instance.main,
    aws_elasticache_cluster.main
  ]
}

# Outputs
output "app_runner_service_url" {
  description = "The App Runner Service URL"
  value       = "Check the AWS console for the App Runner Service URL"
}

output "app_runner_service_arn" {
  description = "The App Runner Service ARN"
  value       = "Check the AWS console for the App Runner Service ARN"
}

output "ecr_repository_url" {
  description = "The URL of the ECR repository where the app's Docker image will be stored"
  value       = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com/${var.app_name}"
}

output "db_hostname" {
  description = "The Database hostname"
  value       = aws_db_instance.main.address
}

output "db_name" {
  description = "The Database name"
  value       = aws_db_instance.main.db_name
}

output "redis_hostname" {
  description = "The Redis hostname"
  value       = aws_elasticache_cluster.main.cache_nodes.0.address
} 