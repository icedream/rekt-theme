def gitBranchSlugUnderscore = env.BRANCH_NAME.replaceAll(/[^A-Za-z0-9]/, "_")
def gitBranchSlugDash = env.BRANCH_NAME.replaceAll(/[^A-Za-z0-9]/, "-")

// Fully qualified docker images to pull
def nodeImage = "node:8"

// Abort build under some conditions
@NonCPS
def shouldSkip() {
	if (currentBuild.changeSets != null) {
		def skipMarkerFound = false;
		for (changeSet in currentBuild.changeSets) {
			for (entry in changeSet) {
				// Check for [ci skip]
				skipMarkerFound = !!(entry.comment =~ /\[ci\s+skip\]/)
			}
		}

		if (skipMarkerFound) {
			echo "Skipping CI as last commit contains [ci skip]."
			return true
		}
	}
	return false
}

node {
	checkout scm
}
if (shouldSkip()) {
	manager.buildNotBuilt()
	return
}

pipeline {
	agent none
	options {
		ansiColor('xterm')
	}
	stages {
		stage('code-quality:lint') {
			agent {
				docker {
					label 'docker'
					image nodeImage
				}
			}
			environment {
				NODE_ENV = "testing"
			}
			steps {
				sh "yarn"
				sh "yarn lint -f checkstyle -o checkstyle.xml || true"
				stash name: 'lint', includes: 'checkstyle.xml'
			}
		}
		stage('code-quality:lint-publish') {
			agent {
				docker {
					label 'docker'
					image 'busybox'
				}
			}
			steps {
				unstash 'lint'
				checkstyle canRunOnFailed: true, pattern: 'checkstyle.xml'
			}
		}
		stage('build') {
			agent {
				docker {
					label 'docker && linux && amd64'
					image nodeImage
				}
			}
			steps {
				sh """
				yarn
				yarn build:production
				"""
				dir("dist") {
					archiveArtifacts '**'
				}
			}
		}
	}
}
