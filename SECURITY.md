# Security Policy

## Supported Versions

| Version line | Support status |
| --- | --- |
| Current `main` branch and the latest release | Receives security fixes |
| Older versions or historical commits | Not guaranteed |

## Reporting a Vulnerability

If you find a security vulnerability, please use GitHub's private vulnerability reporting: go to the repository's **Security** tab and choose **Report a vulnerability**. Please do not disclose vulnerability details in public issues, discussions, or commit messages, and do not submit any real credentials to the repository.

## Credential Security

Sensitive information such as the M-Team API Token, qBittorrent username/password, and PushPlus Token should be provided via `.env` or environment variables, and must never be committed to the repository. If a leak occurs, rotate or revoke the affected credentials immediately at the corresponding service.

## Response Expectations

This is a personal project. The maintainer will make a best effort to confirm, fix, and release security updates within their capacity; response times are not a commercial SLA.
