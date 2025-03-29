# VPC and Networking
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(
    local.common_tags,
    {
      Name = "${local.resource_prefix}-vpc"
    }
  )
}

# Public Subnets
resource "aws_subnet" "public_1" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = merge(
    local.common_tags,
    {
      Name = "${local.resource_prefix}-public-subnet-1"
    }
  )
}

resource "aws_subnet" "public_2" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "${var.aws_region}b"
  map_public_ip_on_launch = true

  tags = merge(
    local.common_tags,
    {
      Name = "${local.resource_prefix}-public-subnet-2"
    }
  )
}

# Private Subnets for RDS and ElastiCache
resource "aws_subnet" "private_1" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.3.0/24"
  availability_zone = "${var.aws_region}a"

  tags = merge(
    local.common_tags,
    {
      Name = "${local.resource_prefix}-private-subnet-1"
    }
  )
}

resource "aws_subnet" "private_2" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.4.0/24"
  availability_zone = "${var.aws_region}b"

  tags = merge(
    local.common_tags,
    {
      Name = "${local.resource_prefix}-private-subnet-2"
    }
  )
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(
    local.common_tags,
    {
      Name = "${local.resource_prefix}-igw"
    }
  )
}

# Route Tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.resource_prefix}-public-rt"
    }
  )
}

# Route Table Associations
resource "aws_route_table_association" "public_1" {
  subnet_id      = aws_subnet.public_1.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_2" {
  subnet_id      = aws_subnet.public_2.id
  route_table_id = aws_route_table.public.id
}

# Security Groups
resource "aws_security_group" "app_runner" {
  name        = "${local.resource_prefix}-apprunner-sg"
  description = "Security group for App Runner VPC connector"
  vpc_id      = aws_vpc.main.id

  tags = merge(
    local.common_tags,
    {
      Name = "${local.resource_prefix}-apprunner-sg"
    }
  )
}

resource "aws_security_group_rule" "app_runner_to_database" {
  security_group_id        = aws_security_group.app_runner.id
  type                     = "egress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.database.id
  description              = "Allow PostgreSQL access to RDS instance"
}

resource "aws_security_group_rule" "app_runner_to_vpc" {
  security_group_id = aws_security_group.app_runner.id
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["10.0.0.0/16"]
  description       = "Allow all traffic to VPC CIDR range"
}

resource "aws_security_group_rule" "app_runner_to_redis" {
  security_group_id        = aws_security_group.app_runner.id
  type                     = "egress"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.redis.id
  description              = "Allow Redis access"
}

resource "aws_security_group_rule" "app_runner_to_internet" {
  security_group_id = aws_security_group.app_runner.id
  type              = "egress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "Allow HTTPS outbound traffic to the internet for external API access"
}

# Add HTTP egress rule to allow complete web traffic
resource "aws_security_group_rule" "app_runner_to_internet_http" {
  security_group_id = aws_security_group.app_runner.id
  type              = "egress"
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "Allow HTTP outbound traffic to the internet"
}

# Add DNS resolution ability via UDP
resource "aws_security_group_rule" "app_runner_dns_udp" {
  security_group_id = aws_security_group.app_runner.id
  type              = "egress"
  from_port         = 53
  to_port           = 53
  protocol          = "udp"
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "Allow DNS resolution via UDP"
}

# Add DNS resolution ability via TCP
resource "aws_security_group_rule" "app_runner_dns_tcp" {
  security_group_id = aws_security_group.app_runner.id
  type              = "egress"
  from_port         = 53
  to_port           = 53
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "Allow DNS resolution via TCP"
}

resource "aws_security_group" "database" {
  name        = "${local.resource_prefix}-db-sg"
  description = "Security group for RDS instance"
  vpc_id      = aws_vpc.main.id

  tags = merge(
    local.common_tags,
    {
      Name = "${local.resource_prefix}-db-sg"
    }
  )
}

resource "aws_security_group_rule" "database_from_app_runner" {
  security_group_id        = aws_security_group.database.id
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.app_runner.id
  description              = "Allow PostgreSQL access from App Runner"
}

resource "aws_security_group_rule" "database_from_vpc" {
  security_group_id = aws_security_group.database.id
  type              = "ingress"
  from_port         = 5432
  to_port           = 5432
  protocol          = "tcp"
  cidr_blocks       = ["10.0.0.0/16"]
  description       = "Allow PostgreSQL access from entire VPC range"
}

resource "aws_security_group_rule" "database_egress" {
  security_group_id = aws_security_group.database.id
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "Allow all outbound traffic"
}

resource "aws_security_group" "redis" {
  name        = "${local.resource_prefix}-redis-sg"
  description = "Security group for ElastiCache Redis"
  vpc_id      = aws_vpc.main.id

  tags = merge(
    local.common_tags,
    {
      Name = "${local.resource_prefix}-redis-sg"
    }
  )
}

# Allow Redis connections from App Runner
resource "aws_security_group_rule" "redis_from_app_runner" {
  security_group_id        = aws_security_group.redis.id
  type                     = "ingress"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.app_runner.id
  description              = "Allow Redis access from App Runner"
}

resource "aws_security_group_rule" "redis_egress" {
  security_group_id = aws_security_group.redis.id
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "Allow all outbound traffic"
} 