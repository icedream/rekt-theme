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
		stage('yarn:install') {
			agent {
				docker {
					label 'docker'
					image nodeImage
				}
			}
			steps {
				sh "yarn"
				stash name: 'node_modules', includes: 'node_modules/**'
			}
		}
		stage('code-quality:lint') {
			parallel {
				stage('code-quality:lint:eslint') {
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
						unstash 'node_modules'
						sh "yarn lint:eslint -f checkstyle -o checkstyle_eslint.xml || true"
						stash name: 'lint-eslint', includes: 'checkstyle_eslint.xml'
					}
				}
				stage('code-quality:lint:sass') {
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
						unstash 'node_modules'
						sh "yarn lint:sass -f checkstyle -o checkstyle_less.xml || true"
						stash name: 'lint-sass', includes: 'checkstyle_less.xml'
					}
				}
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
				unstash 'lint-sass'
				unstash 'lint-eslint'
				checkstyle canRunOnFailed: true, pattern: 'checkstyle_*.xml'
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
				unstash 'node_modules'
				sh "yarn build:production"
				dir("dist") {
					archiveArtifacts '**'
				}
			}
		}
	}
}
