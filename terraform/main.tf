terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  # Uncomment this if you want to use Terraform Cloud or S3 for state storage
  # backend "s3" {
  #   bucket = "fuse-terraform-state"
  #   key    = "fuse-trading-backend/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

provider "aws" {
  region = var.aws_region
}

# Get current AWS account identity
data "aws_caller_identity" "current" {}

# Variables
variable "aws_region" {
  description = "AWS region to deploy to"
  type        = string
  default     = "us-east-1"
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "fuse-trading-backend"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
}

variable "db_username" {
  description = "Database username"
  type        = string
  default     = "fuse_user"
  sensitive   = true
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "fuse_api_key" {
  description = "Fuse vendor API key"
  type        = string
  default     = "nSbPbFJfe95BFZufiDwF32UhqZLEVQ5K4wdtJI2e"
  sensitive   = true
}

variable "smtp_host" {
  description = "SMTP host for sending emails"
  type        = string
  default     = "smtp.example.com"
}

variable "smtp_port" {
  description = "SMTP port for sending emails"
  type        = string
  default     = "587"
}

variable "smtp_user" {
  description = "SMTP username"
  type        = string
  default     = "user@example.com"
}

variable "smtp_pass" {
  description = "SMTP password"
  type        = string
  sensitive   = true
}

variable "email_from" {
  description = "Email sender address"
  type        = string
  default     = "reports@fusefinance.com"
}

variable "email_recipients" {
  description = "Email recipients"
  type        = string
  default     = "admin@fusefinance.com"
}

# Local variables
locals {
  resource_prefix = "${var.app_name}-${var.environment}"
  common_tags = {
    Project     = var.app_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# Security Group outputs for import script
output "app_runner_sg_id" {
  description = "The ID of the App Runner security group"
  value       = aws_security_group.app_runner.id
}

output "database_sg_id" {
  description = "The ID of the database security group"
  value       = aws_security_group.database.id
}

output "redis_sg_id" {
  description = "The ID of the Redis security group"
  value       = aws_security_group.redis.id
} 