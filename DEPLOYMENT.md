# AWS App Runner Deployment Guide for Fuse Trading Backend

This guide explains how to deploy the Fuse Trading Backend to AWS using App Runner, RDS, and ElastiCache.

## Prerequisites

- AWS Account with appropriate permissions
- AWS CLI installed and configured
- Terraform installed (version 1.0.0+)
- GitHub account with access to the repository
- Docker installed locally
- PostgreSQL client (psql) installed locally

## One-time Setup

### 1. Prepare AWS Credentials

Create an IAM user with programmatic access and the following permissions:

- `AmazonECR-FullAccess`
- `AmazonAppRunnerFullAccess`
- `AmazonRDSFullAccess`
- `AmazonElastiCacheFull Access`
- `AmazonVPCFullAccess`

### 2. Configure GitHub Secrets

Add the following secrets to your GitHub repository:

- `AWS_ACCESS_KEY_ID` - Your AWS access key
- `AWS_SECRET_ACCESS_KEY` - Your AWS secret key
- `AWS_REGION` - AWS region (e.g., us-east-1)

### 3. Initialize and Apply Terraform Configuration

```bash
# Create terraform.tfvars file from example
cp terraform/terraform.tfvars.example terraform/terraform.tfvars

# Edit the file with your preferred settings
nano terraform/terraform.tfvars

# Initialize Terraform
cd terraform
terraform init

# Preview changes
terraform plan -var-file=terraform.tfvars

# Apply configuration
terraform apply -var-file=terraform.tfvars
```

After successful Terraform application, you will receive output values including:

- `app_runner_service_url` - The URL to access your deployed application
- `ecr_repository_url` - The ECR repository URL
- `app_runner_service_arn` - The ARN of your App Runner service
- `db_hostname` - The hostname of your RDS database

### 4. Initialize the Database Schema

You'll need to initialize the database schema using the existing schema.sql file in the docker/init-scripts directory:

```bash
# Get database outputs from Terraform
DB_HOSTNAME=$(terraform output -raw db_hostname)
DB_NAME=fuse
DB_USER=$(grep db_username terraform.tfvars | cut -d '=' -f2 | tr -d ' "')
DB_PASSWORD=$(grep db_password terraform.tfvars | cut -d '=' -f2 | tr -d ' "')

# Connect to the database and run the schema
cd ..
psql "postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOSTNAME}:5432/${DB_NAME}" \
  -f docker/init-scripts/schema.sql
```

If you're unable to connect directly due to network restrictions, you can:

1. Create an EC2 instance in the same VPC as your RDS database
2. Copy the schema.sql file to the EC2 instance
3. Run the psql command from the EC2 instance

Alternatively, you can use AWS RDS Query Editor in the AWS Console:

1. Navigate to the RDS service in AWS Console
2. Select your database instance
3. Click on "Query Editor" in the left navigation
4. Connect to your database
5. Copy and paste the contents of schema.sql
6. Run the queries

### 5. Add the App Runner Service ARN to GitHub Secrets

Add the following secret to your GitHub repository:

- `APP_RUNNER_SERVICE_ARN` - The ARN of your App Runner service from Terraform output

## CI/CD Pipeline

The GitHub Actions workflow defined in `.github/workflows/main.yml` automates the following steps:

1. **Test**: Runs linting and unit tests
2. **Build and Push**: Builds the Docker image and pushes it to Amazon ECR
3. **Deploy**: Updates the App Runner service with the new image
4. **Terraform** (disabled by default): Updates infrastructure when needed

## Manual Deployment

If you need to deploy manually:

```bash
# Build the Docker image
docker build -t fuse-trading-backend .

# Tag the image
aws ecr get-login-password --region <your-region> | docker login --username AWS --password-stdin <your-account-id>.dkr.ecr.<your-region>.amazonaws.com
docker tag fuse-trading-backend:latest <your-account-id>.dkr.ecr.<your-region>.amazonaws.com/fuse-trading-backend:latest

# Push the image
docker push <your-account-id>.dkr.ecr.<your-region>.amazonaws.com/fuse-trading-backend:latest

# Update App Runner service
aws apprunner update-service \
  --service-arn <your-app-runner-service-arn> \
  --source-configuration '{"ImageRepository": {"ImageIdentifier": "<your-account-id>.dkr.ecr.<your-region>.amazonaws.com/fuse-trading-backend:latest", "ImageConfiguration": {"Port": "3000"}, "ImageRepositoryType": "ECR"}}'
```

## Accessing Your Application

Once deployed, your application will be available at the App Runner service URL, which you can find in:

- The Terraform output
- The AWS App Runner console

## Database Management

### Schema Updates

For future database schema updates, you have several options:

1. **Manual Updates**: Connect to the RDS instance using psql or a database management tool and run SQL commands
2. **CI/CD Pipeline**: Add a database migration step to your GitHub Actions workflow
3. **Application Migrations**: Implement an automatic migration system in your application

Example of adding a database migration step to your CI/CD pipeline:

```yaml
- name: Apply database migrations
  run: |
    # Install PostgreSQL client
    apt-get update && apt-get install -y postgresql-client

    # Apply migrations
    psql "postgresql://${{ secrets.DB_USERNAME }}:${{ secrets.DB_PASSWORD }}@${{ secrets.DB_HOSTNAME }}:5432/fuse" \
      -f migrations/latest.sql
```

## Troubleshooting

### Viewing Logs

View the logs of your App Runner service:

```bash
aws apprunner list-services
aws apprunner list-operations --service-arn <your-app-runner-service-arn>
```

You can also view logs in the AWS Console under App Runner > Your Service > Logs.

### Common Issues

1. **Database Connection Error**: Ensure the security groups are properly configured to allow traffic from App Runner to RDS.
2. **Redis Connection Error**: Check that the ElastiCache security group allows inbound traffic from App Runner.
3. **App Runner Service Fails to Start**: Check the environment variables and ensure they are correctly set.
4. **Database Schema Issues**: Verify the schema was successfully applied by connecting to the database:
   ```bash
   psql "postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOSTNAME}:5432/${DB_NAME}" -c "\dt"
   ```

## Scaling

App Runner automatically scales your application based on traffic. By default, it will:

- Scale up to handle increased traffic
- Scale down to 1 instance during idle periods
- Auto-scale to zero after 15 minutes of inactivity (default)

## Monitoring

Set up CloudWatch alarms to monitor:

- CPU and memory utilization
- Request count and latency
- 4xx and 5xx error rates

## Cost Estimation

Approximate monthly costs for this deployment:

- App Runner: ~$20-$50/month (depends on traffic)
- RDS (db.t3.micro): ~$15/month
- ElastiCache (cache.t3.micro): ~$15/month
- Data transfer: Variable based on usage

Total estimated cost: **$50-$100/month** for low-traffic applications.

## Clean Up

To avoid incurring future charges, clean up the resources:

```bash
cd terraform
terraform destroy -var-file=terraform.tfvars
```
