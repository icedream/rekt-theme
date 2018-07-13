def gitBranchSlugUnderscore = env.BRANCH_NAME.replaceAll(/[^A-Za-z0-9]/, "_")
def gitBranchSlugDash = env.BRANCH_NAME.replaceAll(/[^A-Za-z0-9]/, "-")

// Stack name under which to deploy the stack, must not conflict with other
// projects!
def dockerStackName = "rekttheme_${gitBranchSlugUnderscore}"

// Hostnames
/*
| Component | master | develop | other branches |
| --- | --- | --- | --- |
| Frontend | https://rekt-theme.icedream.tech | https://develop.review.rekt-theme.icedream.tech | https://${gitBranchSlugDash}.review.rekt-theme.icedream.tech |
 */
def projectDomainBase = 'rekt-theme.icedream.tech'
def projectReviewDomainBase = "review.${projectDomainBase}"

def projectTag = "latest"
def projectFrontendHostname = projectDomainBase
if (env.BRANCH_NAME != "master") {
	projectTag = gitBranchSlugDash
	projectFrontendHostname = "${gitBranchSlugDash}.${projectReviewDomainBase}"
}

// How to access the swarm manager of the deployment infrastructure
def dockerSwarmManagerUrl = 'tcp://prod-docker-mgr.dmz.dreamnetwork.oss:2375'
def dockerSwarmManagerCredentials = 'docker_socket_project_gitea_icedream'

// Docker image version tags
def dockerVersion = '18.03'
def dockerComposeVersion = '1.21.2'

// Fully qualified docker images to pull
def dockerImage = "docker:${dockerVersion}"
def dockerComposeImage = "docker/compose:${dockerComposeVersion}"
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
	environment {
		REKTTHEME_FRONTEND_HOSTNAME = "${projectFrontendHostname}"
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

		stage('build:image') {
			agent {
				docker {
					label 'docker && linux && amd64'
					image dockerImage
					// pass through to host Docker instance
					args '-v /var/run/docker.sock:/var/run/docker.sock'
				}
			}
			environment {
				REKTTHEME_FRONTEND_IMAGE = "${dockerProjectFrontendImageName}:${projectTag}"
			}
			steps {
				sh """
				apk add --no-cache python3 py3-pip
				pip3 install docker-compose==${dockerComposeVersion}
				"""
				sh """
				export PATH="$PATH:/var/tmp/deps/docker-compose"
				cd deployment
				docker-compose build \"frontend\"
				docker-compose push \"frontend\"
				"""
				sh "docker inspect -f \"REKTTHEME_FRONTEND_IMAGE={{index .RepoDigests 0}}\" \"${dockerProjectFrontendImageName}:${projectTag}\" > deployment/frontend.env"
				stash includes: 'deployment/frontend.env', name: 'deploymentFrontendEnv'
			}
		}

		stage('predeploy') {
			parallel {
				stage('predeploy:stack-config') {
					agent {
						docker {
							label 'docker'
							image dockerImage
						}
					}
					steps {
						sh """
						apk add --no-cache python3 py3-pip
						pip3 install docker-compose==${dockerComposeVersion}
						"""
						unstash "deploymentFrontendEnv"
						sh """
						export PATH="$PATH:/var/tmp/deps/docker-compose"
						cd deployment
						for envfile in ./*.env; do
							source \"\${envfile}\"
						done
						export REKTTHEME_FRONTEND_IMAGE
						docker-compose config > .docker-compose.yml
						"""
						archive "deployment/.docker-compose.yml"
						stash includes: 'deployment/.docker-compose.yml', name: 'finalStackConfig'
					}
				}
			}
		}

		stage('deploy') { 
			agent {
				label 'docker'
			}
			steps {
				unstash "finalStackConfig"
				script {
					docker.withServer(dockerSwarmManagerUrl, dockerSwarmManagerCredentials) {
						sh "docker stack rm ${dockerStackName}"
						sleep 10
						sh "cd deployment && docker stack deploy -c .docker-compose.yml ${dockerStackName}"
					}
					currentBuild.description = """
- Frontend web server:\thttps://${env.REKTTHEME_FRONTEND_HOSTNAME}
"""
				}
			}
		}
	}
}
