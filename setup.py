"""
QiFlow Control Center - Swarm Heartbeat Agent Setup
"""

from setuptools import setup, find_packages
from pathlib import Path

# Read the long description from README
this_directory = Path(__file__).parent
long_description = (this_directory / "README.md").read_text(encoding="utf-8")

setup(
    name="qiflow-heartbeat",
    version="0.1.0",
    author="QiFlow Team",
    author_email="contact@qiflow.dev",
    description="Swarm heartbeat agent for QiFlow Control Center",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/yourusername/QiFlowGo",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Build Tools",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
    python_requires=">=3.8",
    install_requires=[
        "requests>=2.31.0",
        "psutil>=5.9.0",
        "Flask>=3.0.0",
        "Flask-CORS>=4.0.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.4.0",
            "pytest-cov>=4.1.0",
            "pytest-mock>=3.11.0",
            "responses>=0.23.0",
            "black>=23.7.0",
            "flake8>=6.1.0",
            "mypy>=1.5.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "qiflow-heartbeat=core.heartbeat:main",
            "qiflow-api-server=core.api_server:main",
        ],
    },
)
