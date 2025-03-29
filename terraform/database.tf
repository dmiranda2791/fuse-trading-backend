# RDS PostgreSQL Database
resource "aws_db_subnet_group" "main" {
  name       = "${local.resource_prefix}-db-subnet-group"
  subnet_ids = [aws_subnet.private_1.id, aws_subnet.private_2.id]

  tags = merge(
    local.common_tags,
    {
      Name = "${local.resource_prefix}-db-subnet-group"
    }
  )
}

resource "aws_db_parameter_group" "postgres" {
  name   = "${local.resource_prefix}-postgres15-params"
  family = "postgres15"

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name         = "rds.force_ssl"
    value        = "0"
    apply_method = "pending-reboot"
  }

  # Add monitoring parameters
  parameter {
    name  = "log_hostname"
    value = "1"
    apply_method = "pending-reboot"
  }
  
  parameter {
    name  = "log_statement"
    value = "ddl"
    apply_method = "pending-reboot"
  }
  
  # Use both authentication methods instead of just scram-sha-256
  parameter {
    name  = "password_encryption"
    value = "md5"
    apply_method = "pending-reboot"
  }
  
  # Add this parameter to allow both authentication methods
  parameter {
    name  = "rds.accepted_password_auth_method"
    value = "md5+scram"
    apply_method = "pending-reboot"
  }
  
  tags = local.common_tags
}

resource "aws_db_instance" "main" {
  identifier             = "${local.resource_prefix}-db"
  engine                 = "postgres"
  engine_version         = "15"
  instance_class         = "db.t3.micro"
  allocated_storage      = 20
  db_name                = "fuse"
  username               = var.db_username
  password               = var.db_password
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.database.id]
  parameter_group_name   = aws_db_parameter_group.postgres.name
  publicly_accessible    = false
  skip_final_snapshot    = true
  apply_immediately      = true
  deletion_protection    = false  # Set to true for production
  
  # Enable additional logging
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  
  # Additional settings for improved connectivity
  backup_retention_period = 7
  multi_az                = false  # Set to true for production
  storage_encrypted       = true

  tags = merge(
    local.common_tags,
    {
      Name = "${local.resource_prefix}-db"
    }
  )
}

# ElastiCache Redis
resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.resource_prefix}-redis-subnet-group"
  subnet_ids = [aws_subnet.private_1.id, aws_subnet.private_2.id]

  tags = local.common_tags
}

resource "aws_elasticache_parameter_group" "redis" {
  name   = "${local.resource_prefix}-redis-params"
  family = "redis7"

  tags = local.common_tags
}

resource "aws_elasticache_cluster" "main" {
  cluster_id           = "${var.app_name}-${var.environment}-redis"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = aws_elasticache_parameter_group.redis.name
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]
  port                 = 6379

  tags = merge(
    local.common_tags,
    {
      Name = "${local.resource_prefix}-redis"
    }
  )
}

# Note: Database schema initialization
# For RDS, we'll need to run the schema initialization after the instance is created.
# This is handled by the application's database migration system at first startup,
# or can be manually applied using the schema.sql file from docker/init-scripts.
# See DEPLOYMENT.md for instructions on database initialization. 