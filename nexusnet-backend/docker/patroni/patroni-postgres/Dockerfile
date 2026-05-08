FROM postgres:15

RUN apt-get update \
  && apt-get install -y python3-pip python3-dev libpq-dev gcc build-essential curl \
  && pip3 install --no-cache-dir --break-system-packages patroni[etcd] psycopg2-binary \
  && rm -rf /var/lib/apt/lists/*

COPY start-patroni.sh /usr/local/bin/start-patroni.sh
RUN chmod +x /usr/local/bin/start-patroni.sh

EXPOSE 5432 8008

USER postgres

CMD ["/usr/local/bin/start-patroni.sh"]
