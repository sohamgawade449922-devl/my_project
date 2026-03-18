terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.7"
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  default = "ap-south-1"
}

variable "app_name" {
  default = "neuralcommander"
}

# -----------------------------------------------------------------------
# VPC
# -----------------------------------------------------------------------
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "${var.app_name}-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["ap-south-1a", "ap-south-1b"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]

  enable_nat_gateway = true
}

# -----------------------------------------------------------------------
# ECS Cluster
# -----------------------------------------------------------------------
resource "aws_ecs_cluster" "main" {
  name = "${var.app_name}-cluster"
}

# -----------------------------------------------------------------------
# RDS PostgreSQL (with pgvector via parameter group)
# -----------------------------------------------------------------------
resource "aws_db_instance" "postgres" {
  identifier             = "${var.app_name}-db"
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = "db.t3.micro"
  allocated_storage      = 20
  db_name                = "neuralcommander"
  username               = "neural"
  password               = var.db_password
  skip_final_snapshot    = true
  publicly_accessible    = false
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name

  parameter_group_name = aws_db_parameter_group.pgvector.name
}

resource "aws_db_parameter_group" "pgvector" {
  name   = "${var.app_name}-pgvector"
  family = "postgres16"

  parameter {
    name  = "shared_preload_libraries"
    value = "vector"
  }
}

resource "aws_db_subnet_group" "main" {
  name       = "${var.app_name}-db-subnet"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_security_group" "rds" {
  name   = "${var.app_name}-rds-sg"
  vpc_id = module.vpc.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = module.vpc.private_subnets_cidr_blocks
  }
}

variable "db_password" {
  description = "RDS master password"
  sensitive   = true
}

# -----------------------------------------------------------------------
# ElastiCache Redis
# -----------------------------------------------------------------------
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "${var.app_name}-redis"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.main.name
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.app_name}-redis-subnet"
  subnet_ids = module.vpc.private_subnets
}

output "db_endpoint" {
  value = aws_db_instance.postgres.endpoint
}

output "redis_endpoint" {
  value = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "ecs_cluster_arn" {
  value = aws_ecs_cluster.main.arn
}
